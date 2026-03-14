import re


class LogParser:
    PATTERNS = {
        "python_traceback": r'Traceback \(most recent call last\):.*?(\w+Error: .+)',
        "python_assertion": r'(AssertionError: .+)',
        "python_import": r'(ModuleNotFoundError: No module named .+)',
        "python_syntax": r'(SyntaxError: .+)',
        "npm_error": r'(npm ERR! .+)',
        "docker_error": r'(ERROR \[.+\] .+)',
        "pytest_failure": r'FAILED (.+::test_\w+)',
        "file_line": r'File "(.+)", line (\d+)',
        "exit_code": r'Process completed with exit code (\d+)',
        "flake8": r'(\S+\.py:\d+:\d+: [A-Z]\d+ .+)',
        "eslint": r'(\d+:\d+\s+error\s+.+)',
        "compilation": r'(error[:\s].+)',
        "dependency": r'(Could not find a version that satisfies|ERESOLVE|peer dep)',
        "timeout": r'(The operation was canceled|timed? ?out)',
        "permission": r'(Permission denied|EACCES)',
    }

    CATEGORIES = {
        "python_traceback": "runtime",
        "python_assertion": "test",
        "python_import": "dependency",
        "python_syntax": "syntax",
        "npm_error": "dependency",
        "pytest_failure": "test",
        "flake8": "lint",
        "eslint": "lint",
        "compilation": "build",
        "dependency": "dependency",
        "docker_error": "build",
        "timeout": "infrastructure",
        "permission": "infrastructure",
    }

    def parse(self, logs_dict):
        if not logs_dict:
            return {"error_type": "Unknown", "error_message": "No logs available", "category": "unknown"}

        all_failures = []
        for job_name, job_data in logs_dict.items():
            log_text = job_data.get("log", "")
            steps = job_data.get("steps", [])

            failure = {
                "job_name": job_name,
                "failed_step": self._find_failed_step(steps),
                "error_type": None,
                "error_message": None,
                "file": None,
                "line": None,
                "full_traceback": None,
                "exit_code": None,
                "category": None,
                "raw_error": None,
            }

            tb_match = re.search(
                r'(Traceback \(most recent call last\):.+?)(?=\n\n|\Z)',
                log_text, re.DOTALL
            )
            if tb_match:
                failure["full_traceback"] = tb_match.group(1)

            file_match = re.findall(r'File "(.+?)", line (\d+)', log_text)
            if file_match:
                failure["file"] = file_match[-1][0]
                failure["line"] = int(file_match[-1][1])

            for pattern_name, pattern in self.PATTERNS.items():
                match = re.search(pattern, log_text, re.DOTALL)
                if match:
                    error_str = match.group(1) if match.lastindex else match.group(0)
                    if ":" in error_str:
                        parts = error_str.split(":", 1)
                        failure["error_type"] = parts[0].strip()
                        failure["error_message"] = parts[1].strip()
                    else:
                        failure["error_type"] = pattern_name
                        failure["error_message"] = error_str
                    failure["category"] = self.CATEGORIES.get(pattern_name, "unknown")
                    break

            exit_match = re.search(r'exit code (\d+)', log_text)
            if exit_match:
                failure["exit_code"] = int(exit_match.group(1))

            failure["raw_error"] = self._extract_error_context(log_text)
            all_failures.append(failure)

        return all_failures[0] if len(all_failures) == 1 else (all_failures[0] if all_failures else {})

    def _find_failed_step(self, steps):
        for step in steps:
            if step.get("conclusion") == "failure":
                return step["name"]
        return "Unknown"

    def get_affected_files(self, failure_info):
        files = []
        if isinstance(failure_info, list):
            for f in failure_info:
                if f.get("file"):
                    files.append(f["file"])
        else:
            if failure_info.get("file"):
                files.append(failure_info["file"])
            if failure_info.get("full_traceback"):
                tb_files = re.findall(r'File "(.+?)"', failure_info["full_traceback"])
                for f in tb_files:
                    if not f.startswith("/usr") and f not in files:
                        files.append(f)
        return files

    def _extract_error_context(self, log_text, context_lines=50):
        lines = log_text.split('\n')
        error_indicators = ['Error', 'FAILED', 'error', 'FATAL', 'Exception', 'Traceback']
        error_line_idx = None
        for i, line in enumerate(lines):
            if any(ind in line for ind in error_indicators):
                error_line_idx = i
        if error_line_idx is not None:
            start = max(0, error_line_idx - context_lines // 2)
            end = min(len(lines), error_line_idx + context_lines // 2)
            return '\n'.join(lines[start:end])
        return '\n'.join(lines[-context_lines:])
