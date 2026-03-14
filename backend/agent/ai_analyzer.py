import json
import logging
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert CI/CD debugging and healing agent.
You analyze CI/CD pipeline failures, identify root causes, and generate precise code fixes.

Your responses must be valid JSON with this structure:
{
    "root_cause": "Detailed explanation of why the failure occurred",
    "fix_description": "What the fix does and why it resolves the issue",
    "confidence": "high|medium|low",
    "category": "test|lint|build|dependency|config|syntax|runtime",
    "fixes": [
        {
            "file": "path/to/file.py",
            "action": "modify|create|delete",
            "content": "complete file content with the fix applied",
            "diff_summary": "what changed and why"
        }
    ],
    "summary": "One-line summary for commit message",
    "risk_assessment": "Description of potential risks of this fix",
    "alternative_fixes": ["Other possible approaches"]
}

Rules:
1. NEVER change test assertions to match wrong behavior - fix the source code
2. Prefer minimal, targeted fixes
3. If a dependency is missing, add it to requirements.txt/package.json
4. If confidence is "low", explain why in risk_assessment
5. Return the COMPLETE file content in fixes, not just the diff
6. Preserve all existing functionality
7. If you cannot determine the fix, set confidence to "low" and explain"""


class AIAnalyzer:
    def __init__(self, api_key, model="gpt-4o"):
        self.api_key = api_key
        self.model = model

    async def analyze_failure(self, failure_info, file_contents):
        try:
            import uuid
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"heal-{uuid.uuid4().hex[:8]}",
                system_message=SYSTEM_PROMPT
            )
            chat.with_model("openai", self.model)

            prompt = self._build_prompt(failure_info, file_contents)
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)

            # Try to parse JSON from response
            try:
                # Find JSON in response
                start = response.find('{')
                end = response.rfind('}') + 1
                if start >= 0 and end > start:
                    result = json.loads(response[start:end])
                    return result
            except json.JSONDecodeError:
                pass

            return {
                "root_cause": response,
                "fix_description": "AI analysis completed - manual review recommended",
                "confidence": "medium",
                "category": failure_info.get("category", "unknown"),
                "fixes": [],
                "summary": "AI analyzed failure - see root cause",
                "risk_assessment": "Manual review recommended",
                "alternative_fixes": []
            }

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return {
                "root_cause": f"AI analysis error: {str(e)}",
                "fix_description": "Unable to generate automated fix",
                "confidence": "low",
                "category": failure_info.get("category", "unknown") if isinstance(failure_info, dict) else "unknown",
                "fixes": [],
                "summary": "Analysis failed",
                "risk_assessment": "High - automated analysis was not possible",
                "alternative_fixes": ["Manual investigation required"]
            }

    def _build_prompt(self, failure_info, file_contents):
        prompt = f"""## CI/CD Pipeline Failure Report

### Failure Details
- **Failed Step:** {failure_info.get('failed_step', 'Unknown')}
- **Error Type:** {failure_info.get('error_type', 'Unknown')}
- **Error Message:** {failure_info.get('error_message', 'Unknown')}
- **File:** {failure_info.get('file', 'Unknown')}
- **Line:** {failure_info.get('line', 'Unknown')}
- **Category:** {failure_info.get('category', 'Unknown')}
- **Exit Code:** {failure_info.get('exit_code', 'Unknown')}

### Full Traceback/Error Log
```
{failure_info.get('full_traceback', failure_info.get('raw_error', 'Not available'))}
```

### Source Files
"""
        for fpath, content in file_contents.items():
            prompt += f"\n#### `{fpath}`\n```\n{content}\n```\n"

        prompt += """
### Task
Analyze the failure, identify the root cause, and generate a fix.
Return your response as JSON matching the specified schema."""
        return prompt
