import json
import logging
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

SCAN_SYSTEM_PROMPT = """You are an expert code reviewer and bug hunter for open-source projects.
Analyze the provided code file thoroughly and identify ALL issues including:
1. Code bugs (logic errors, null/undefined references, type errors, race conditions)
2. Security vulnerabilities (injection, XSS, auth issues, exposed secrets)
3. Performance issues (N+1 queries, memory leaks, unnecessary computations)
4. Code quality (dead code, duplicated code, unclear naming, missing error handling)

Return ONLY a valid JSON array of issues found. Each issue:
{
  "title": "Brief title of the issue",
  "description": "Detailed explanation of the bug/issue and its impact",
  "severity": "critical|high|medium|low",
  "type": "bug|security|performance|quality",
  "line_start": <line number or null>,
  "line_end": <line number or null>,
  "code_snippet": "the problematic code snippet",
  "suggested_fix": "brief description of how to fix it"
}

Rules:
- Focus on REAL bugs, not style preferences
- Be specific about line numbers
- Explain WHY something is a bug
- Prioritize issues that could cause runtime failures
- Don't report trivial style issues unless they hide bugs
- If no issues found, return empty array []"""

FIX_SYSTEM_PROMPT = """You are an expert software engineer fixing bugs in open-source projects.
Generate a precise code fix for the described issue. Follow open-source contribution standards.

Return ONLY valid JSON:
{
  "fixed_content": "the COMPLETE file content with the fix applied",
  "commit_message": "conventional commit message (e.g., fix: resolve null pointer in handler)",
  "explanation": "detailed explanation of what was changed and why",
  "diff_summary": "human-readable summary of changes made",
  "breaking_changes": false,
  "files_changed": ["path/to/file.py"]
}

Rules:
1. Return the COMPLETE file content, not just the diff
2. Use conventional commit format: fix:, feat:, refactor:, perf:, security:
3. Make MINIMAL changes - only fix the specific issue
4. Preserve all existing functionality
5. Follow the project's existing code style
6. Add inline comments explaining non-obvious fixes"""

TEST_SYSTEM_PROMPT = """You are an expert test engineer writing test cases for bug fixes in open-source projects.
Generate comprehensive test cases that verify the fix works correctly.

Return ONLY valid JSON:
{
  "test_file_path": "tests/test_<relevant_name>.py",
  "test_content": "complete test file content",
  "test_framework": "pytest|jest|unittest",
  "test_count": <number of tests>,
  "test_descriptions": ["description of each test case"],
  "setup_required": "any setup instructions or dependencies needed"
}

Rules:
1. Write tests that FAIL before the fix and PASS after
2. Include edge cases and boundary conditions
3. Use the project's existing test framework if detectable
4. Keep tests focused and independent
5. Add clear test docstrings
6. Include both positive and negative test cases"""


class CodeAnalyzer:
    def __init__(self, api_key, model="gpt-4o"):
        self.api_key = api_key
        self.model = model

    async def analyze_file(self, file_path, file_content, repo_context=""):
        """Analyze a single file for bugs and issues."""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"scan-{uuid.uuid4().hex[:8]}",
                system_message=SCAN_SYSTEM_PROMPT
            )
            chat.with_model("openai", self.model)

            prompt = f"""## File to Analyze
**Path:** `{file_path}`
{f"**Repo Context:** {repo_context}" if repo_context else ""}

```
{file_content[:8000]}
```

Analyze this file and return a JSON array of all issues found."""

            response = await chat.send_message(UserMessage(text=prompt))
            return self._parse_json_array(response)
        except Exception as e:
            logger.error(f"AI analysis failed for {file_path}: {e}")
            return []

    async def generate_fix(self, file_path, file_content, issue):
        """Generate a code fix for a specific issue."""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"fix-{uuid.uuid4().hex[:8]}",
                system_message=FIX_SYSTEM_PROMPT
            )
            chat.with_model("openai", self.model)

            prompt = f"""## Bug Fix Request

### Issue
- **Title:** {issue.get('title', 'Unknown')}
- **Description:** {issue.get('description', 'Unknown')}
- **Severity:** {issue.get('severity', 'Unknown')}
- **File:** `{file_path}`
- **Lines:** {issue.get('line_start', '?')}-{issue.get('line_end', '?')}

### Current File Content
```
{file_content}
```

Generate a fix for this issue. Return the COMPLETE fixed file content as JSON."""

            response = await chat.send_message(UserMessage(text=prompt))
            return self._parse_json_object(response)
        except Exception as e:
            logger.error(f"Fix generation failed: {e}")
            return None

    async def generate_tests(self, file_path, file_content, issue, fix):
        """Generate test cases for the fix."""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"test-{uuid.uuid4().hex[:8]}",
                system_message=TEST_SYSTEM_PROMPT
            )
            chat.with_model("openai", self.model)

            prompt = f"""## Test Generation Request

### Issue Fixed
- **Title:** {issue.get('title', 'Unknown')}
- **Description:** {issue.get('description', 'Unknown')}
- **File:** `{file_path}`

### Fixed Code
```
{fix.get('fixed_content', file_content)[:6000]}
```

### Fix Explanation
{fix.get('explanation', 'Fix applied')}

Generate comprehensive test cases that verify this fix works correctly."""

            response = await chat.send_message(UserMessage(text=prompt))
            return self._parse_json_object(response)
        except Exception as e:
            logger.error(f"Test generation failed: {e}")
            return None

    def _parse_json_array(self, text):
        try:
            start = text.find('[')
            end = text.rfind(']') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
        return []

    def _parse_json_object(self, text):
        try:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
        return None
