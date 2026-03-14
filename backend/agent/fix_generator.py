import logging

logger = logging.getLogger(__name__)


class FixGenerator:
    MAX_FILES_MODIFIED = 5
    MAX_FILE_SIZE = 50000
    PROTECTED_FILES = [
        ".github/workflows/healing-agent.yml",
        ".env",
        "agent/main.py",
    ]

    def generate(self, analysis):
        if not analysis or "fixes" not in analysis:
            return []

        if analysis.get("confidence") == "low":
            logger.warning("Low confidence fix - proceeding with caution")

        validated_fixes = []
        for fix in analysis["fixes"][:self.MAX_FILES_MODIFIED]:
            if fix.get("file") in self.PROTECTED_FILES:
                logger.warning(f"Skipping protected file: {fix['file']}")
                continue
            if len(fix.get("content", "")) > self.MAX_FILE_SIZE:
                logger.warning(f"Fix too large for: {fix['file']}")
                continue
            if fix.get("action") == "delete":
                logger.warning(f"Skipping file deletion: {fix['file']}")
                continue
            if self._basic_validation(fix):
                validated_fixes.append(fix)
            else:
                logger.warning(f"Validation failed for: {fix['file']}")

        return validated_fixes

    def _basic_validation(self, fix):
        content = fix.get("content", "")
        filepath = fix.get("file", "")

        if filepath.endswith(".py"):
            try:
                compile(content, filepath, "exec")
                return True
            except SyntaxError as e:
                logger.error(f"Syntax error in fix: {e}")
                return False

        if filepath.endswith((".yml", ".yaml")):
            try:
                import yaml
                yaml.safe_load(content)
                return True
            except Exception as e:
                logger.error(f"YAML error in fix: {e}")
                return False

        if filepath.endswith(".json"):
            try:
                import json
                json.loads(content)
                return True
            except Exception as e:
                logger.error(f"JSON error in fix: {e}")
                return False

        return True
