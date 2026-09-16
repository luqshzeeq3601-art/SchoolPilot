import pytest
from pathlib import Path
from scripts.validate_workflows import validate_workflow_file, validate_all_workflows, KNOWN_WORKFLOW_IDS


def test_all_workflows_pass_validation():
    repo_root = Path(__file__).resolve().parent.parent.parent
    workflows_dir = repo_root / "workflows"
    assert workflows_dir.exists()
    
    total, failed = validate_all_workflows(workflows_dir)
    assert total == 5
    assert failed == 0


def test_workflow_validator_detects_malformed_json(tmp_path):
    bad_json_file = tmp_path / "bad.json"
    bad_json_file.write_text("{ not valid json }", encoding="utf-8")
    
    errors = validate_workflow_file(bad_json_file)
    assert any("Invalid JSON" in err for err in errors)


def test_workflow_validator_detects_missing_required_fields(tmp_path):
    incomplete_file = tmp_path / "incomplete.json"
    incomplete_file.write_text('{"name": "Test"}', encoding="utf-8")
    
    errors = validate_workflow_file(incomplete_file)
    assert any("nodes" in err for err in errors)
    assert any("connections" in err for err in errors)


def test_workflow_validator_detects_raw_bot_token(tmp_path):
    token_file = tmp_path / "leaked_token.json"
    token_file.write_text(
        '{"name": "Leaked", "nodes": [{"id": "1", "name": "N", "type": "T"}], "connections": {}, "token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567"}',
        encoding="utf-8",
    )
    errors = validate_workflow_file(token_file)
    assert any("Telegram Bot Token" in err for err in errors)


def test_error_alert_workflow_must_not_have_error_workflow(tmp_path):
    looping_error_wf = tmp_path / "error_alert_workflow.json"
    looping_error_wf.write_text(
        '{"name": "Error Alert", "nodes": [{"id": "1", "name": "N", "type": "T"}], "connections": {}, "settings": {"errorWorkflow": "ErrAlert00000001"}}',
        encoding="utf-8",
    )
    errors = validate_workflow_file(looping_error_wf)
    assert any("error_alert_workflow.json must have 'errorWorkflow: null'" in err for err in errors)
