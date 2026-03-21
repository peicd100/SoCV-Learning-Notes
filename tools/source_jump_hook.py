from __future__ import annotations

import json
import logging
import os
import posixpath
import re
import shutil
import subprocess
import urllib.parse
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from markdown_it import MarkdownIt


log = logging.getLogger("mkdocs.hooks.source_jump")

_LOCAL_ENDPOINT_SUFFIX = "/__peicd/source-jump"
_MARKDOWN = MarkdownIt("commonmark", {"html": True}).enable("table")
_PAGE_INDEX: dict[str, "PageRecord"] = {}
_VSCODE_COMMAND: str | None = None


@dataclass
class BlockRecord:
    kind: str
    start_line: int
    end_line: int
    visible_text: str
    normalized_text: str
    normalized_source_offsets: list[int]


@dataclass
class PageRecord:
    src_uri: str
    abs_src_path: str
    dest_uri: str
    markdown: str
    line_starts: list[int]
    blocks: list[BlockRecord]


def on_config(config: Any) -> Any:
    _PAGE_INDEX.clear()
    return config


def on_page_markdown(markdown: str, /, *, page: Any, config: Any, files: Any) -> str:
    file_obj = getattr(page, "file", None)
    if file_obj is None:
        return markdown

    try:
        record = _build_page_record(markdown, file_obj)
        _PAGE_INDEX[record.dest_uri] = record
    except Exception:
        log.exception("Failed to index page source for %s", getattr(file_obj, "src_uri", "<unknown>"))

    return markdown


def on_serve(server: Any, /, *, config: Any, builder: Any) -> Any:
    original_app = server.serve_request

    def serve_request(environ, start_response):
        path = _decode_path(environ.get("PATH_INFO", ""))
        if _is_lookup_request(path):
            return _handle_lookup_request(environ, start_response, server)
        return original_app(environ, start_response)

    server.set_app(serve_request)
    return server


def _decode_path(path: str) -> str:
    return urllib.parse.unquote(path or "")


def _is_lookup_request(path: str) -> bool:
    if not path:
        return False
    normalized = path.rstrip("/")
    return normalized == _LOCAL_ENDPOINT_SUFFIX or normalized.endswith(_LOCAL_ENDPOINT_SUFFIX)


def _handle_lookup_request(environ, start_response, server):
    params = urllib.parse.parse_qs(environ.get("QUERY_STRING", ""), keep_blank_values=True)
    page_param = params.get("page", [""])[0]
    selection = params.get("selection", [""])[0]
    container = params.get("container", [""])[0]
    prefix = params.get("prefix", [""])[0]
    action = params.get("action", ["lookup"])[0].strip().lower()

    if not selection.strip():
        return _json_response(
            start_response,
            status="400 Bad Request",
            payload={"ok": False, "message": "selection is required"},
        )

    page_key = _normalize_page_key(page_param, getattr(server, "mount_path", "/"))
    record = _PAGE_INDEX.get(page_key)
    if record is None:
        return _json_response(
            start_response,
            status="404 Not Found",
            payload={"ok": False, "message": f"page not indexed: {page_key}"},
        )

    result = _locate_selection(record, selection, container, prefix)
    if result.get("ok") and action == "open":
        opened, message = _open_in_vscode(
            result["abs_path"],
            int(result["line"]),
            int(result["column"]),
        )
        result["opened"] = opened
        if message:
            result["message"] = message
        if not opened:
            return _json_response(
                start_response,
                status="500 Internal Server Error",
                payload=result,
            )

    status = "200 OK" if result.get("ok") else "404 Not Found"
    return _json_response(start_response, status=status, payload=result)


def _json_response(start_response, *, status: str, payload: dict[str, Any]):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    start_response(
        status,
        [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
        ],
    )
    return [body]


def _normalize_page_key(page_path: str, mount_path: str) -> str:
    path = urllib.parse.urlsplit(page_path or "").path or ""
    path = _decode_path(path).replace("\\", "/")
    mount = (mount_path or "/").replace("\\", "/")
    if path == mount.rstrip("/"):
        path = ""
    elif mount and mount != "/" and path.startswith(mount):
        path = path[len(mount) :]
    path = path.lstrip("/")
    if not path:
        path = "index.html"
    elif path.endswith("/"):
        path = f"{path}index.html"
    return posixpath.normpath("/" + path).lstrip("/")


def _build_page_record(markdown: str, file_obj: Any) -> PageRecord:
    line_starts = _line_starts(markdown)
    blocks: list[BlockRecord] = []

    for token in _MARKDOWN.parse(markdown):
        if not token.map:
            continue

        visible_text = _visible_text_from_token(token)
        if not visible_text.strip():
            continue

        start_line0, end_line0 = token.map
        block = _build_block_record(
            kind=token.type,
            visible_text=visible_text,
            markdown=markdown,
            line_starts=line_starts,
            start_line0=start_line0,
            end_line0=end_line0,
        )
        if block is None:
            continue
        blocks.append(block)

    return PageRecord(
        src_uri=str(getattr(file_obj, "src_uri", "")).replace("\\", "/"),
        abs_src_path=str(getattr(file_obj, "abs_src_path", "")),
        dest_uri=str(getattr(file_obj, "dest_uri", "")).replace("\\", "/"),
        markdown=markdown,
        line_starts=line_starts,
        blocks=blocks,
    )


def _build_block_record(
    *,
    kind: str,
    visible_text: str,
    markdown: str,
    line_starts: list[int],
    start_line0: int,
    end_line0: int,
) -> BlockRecord | None:
    source_start = line_starts[start_line0]
    source_end = line_starts[end_line0] if end_line0 < len(line_starts) else len(markdown)
    source_slice = markdown[source_start:source_end]
    source_map = _align_visible_text_to_source(visible_text, source_slice, source_start)
    normalized_text, normalized_source_offsets = _normalize_text_with_offsets(visible_text, source_map)

    if not normalized_text:
        return None

    return BlockRecord(
        kind=kind,
        start_line=start_line0 + 1,
        end_line=max(start_line0 + 1, end_line0),
        visible_text=visible_text,
        normalized_text=normalized_text,
        normalized_source_offsets=normalized_source_offsets,
    )


def _visible_text_from_token(token: Any) -> str:
    token_type = getattr(token, "type", "")
    if token_type == "inline":
        return _visible_text_from_inline_children(getattr(token, "children", None))
    if token_type in {"fence", "code_block"}:
        return getattr(token, "content", "")
    if token_type == "html_block":
        return _html_to_text(getattr(token, "content", ""))
    return ""


def _visible_text_from_inline_children(children: Any) -> str:
    if not children:
        return ""

    parts: list[str] = []
    for child in children:
        child_type = getattr(child, "type", "")
        if child_type in {"text", "code_inline"}:
            parts.append(getattr(child, "content", ""))
        elif child_type in {"softbreak", "hardbreak"}:
            parts.append("\n")
        elif child_type == "image":
            alt_text = getattr(child, "content", "") or child.attrGet("alt") or ""
            parts.append(alt_text)
        elif child_type == "html_inline":
            parts.append(_html_to_text(getattr(child, "content", "")))
    return "".join(parts)


def _html_to_text(html: str) -> str:
    if not html:
        return ""
    return BeautifulSoup(html, "html.parser").get_text(" ", strip=False)


def _align_visible_text_to_source(visible_text: str, source_text: str, global_start: int) -> list[int]:
    offsets: list[int] = []
    cursor = 0
    last_offset = global_start

    for char in visible_text:
        if _is_ignored_char(char):
            offsets.append(last_offset)
            continue

        if char.isspace():
            while cursor < len(source_text) and not source_text[cursor].isspace():
                cursor += 1
            if cursor < len(source_text):
                last_offset = global_start + cursor
                offsets.append(last_offset)
                cursor += 1
                while cursor < len(source_text) and source_text[cursor].isspace():
                    cursor += 1
            else:
                offsets.append(last_offset)
            continue

        found = source_text.find(char, cursor)
        if found == -1:
            offsets.append(last_offset)
            continue

        last_offset = global_start + found
        offsets.append(last_offset)
        cursor = found + 1

    return offsets


def _normalize_text(text: str) -> str:
    normalized, _ = _normalize_text_with_offsets(text, list(range(len(text))))
    return normalized


def _normalize_text_with_offsets(text: str, offsets: list[int]) -> tuple[str, list[int]]:
    output_chars: list[str] = []
    output_offsets: list[int] = []
    pending_space = False
    pending_space_offset = 0

    for index, char in enumerate(text):
        if _is_ignored_char(char):
            continue

        char = " " if char == "\xa0" else char
        source_offset = offsets[index] if index < len(offsets) else (offsets[-1] if offsets else 0)

        if char.isspace():
            if output_chars:
                pending_space = True
                pending_space_offset = source_offset
            continue

        if pending_space:
            output_chars.append(" ")
            output_offsets.append(pending_space_offset)
            pending_space = False

        output_chars.append(char)
        output_offsets.append(source_offset)

    return "".join(output_chars), output_offsets


def _locate_selection(record: PageRecord, selection: str, container: str, prefix: str) -> dict[str, Any]:
    selection_norm = _normalize_text(selection)
    container_norm = _normalize_text(container)
    prefix_norm = _normalize_text(prefix)

    if not selection_norm:
        return {"ok": False, "message": "selection became empty after normalization"}

    candidates = [block for block in record.blocks if selection_norm in block.normalized_text]
    if not candidates:
        raw_match_offset = record.markdown.find(selection)
        if raw_match_offset == -1:
            return {
                "ok": False,
                "message": "no matching block found",
                "src_uri": record.src_uri,
            }
        line, column = _offset_to_line_column(record.line_starts, raw_match_offset)
        return _success_payload(record, line, column)

    best_block = max(
        candidates,
        key=lambda block: _block_score(block, selection_norm, container_norm, prefix_norm),
    )
    match_index = _choose_match_index(best_block.normalized_text, selection_norm, prefix_norm)
    if match_index < 0 or match_index >= len(best_block.normalized_source_offsets):
        match_index = 0

    source_offset = best_block.normalized_source_offsets[match_index]
    line, column = _offset_to_line_column(record.line_starts, source_offset)
    return _success_payload(record, line, column)


def _success_payload(record: PageRecord, line: int, column: int) -> dict[str, Any]:
    return {
        "ok": True,
        "src_uri": record.src_uri,
        "abs_path": record.abs_src_path,
        "line": line,
        "column": column,
        "uri": _make_vscode_uri(record.abs_src_path, line, column),
    }


def _block_score(block: BlockRecord, selection_norm: str, container_norm: str, prefix_norm: str) -> float:
    score = 0.0

    if container_norm:
        if block.normalized_text == container_norm:
            score += 6000
        elif container_norm in block.normalized_text:
            score += 4200
        elif block.normalized_text in container_norm:
            score += 3200
        else:
            ratio = SequenceMatcher(None, block.normalized_text[:1500], container_norm[:1500]).ratio()
            score += ratio * 2500

        score -= abs(len(block.normalized_text) - len(container_norm)) / 5

    if prefix_norm:
        desired_index = len(prefix_norm)
        actual_index = _choose_match_index(block.normalized_text, selection_norm, prefix_norm)
        if actual_index >= 0:
            score += max(0, 1400 - abs(actual_index - desired_index) * 4)

    score += max(0, 300 - (block.end_line - block.start_line))
    score += max(0, 200 - block.start_line / 10)
    return score


def _choose_match_index(text: str, needle: str, prefix_norm: str) -> int:
    positions = _find_all(text, needle)
    if not positions:
        return -1
    if not prefix_norm:
        return positions[0]

    desired_index = len(prefix_norm)
    return min(positions, key=lambda position: abs(position - desired_index))


def _find_all(text: str, needle: str) -> list[int]:
    positions: list[int] = []
    start = 0
    while True:
        index = text.find(needle, start)
        if index == -1:
            return positions
        positions.append(index)
        start = index + 1


def _make_vscode_uri(abs_path: str, line: int, column: int) -> str:
    posix_path = abs_path.replace("\\", "/")
    encoded_path = urllib.parse.quote(posix_path, safe="/:")
    return f"vscode://file/{encoded_path}:{line}:{column}"


def _find_vscode_command() -> str | None:
    global _VSCODE_COMMAND
    if _VSCODE_COMMAND:
        return _VSCODE_COMMAND

    candidates = [
        shutil.which("code"),
        shutil.which("code.cmd"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Microsoft VS Code", "Code.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Microsoft VS Code", "Code.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft VS Code", "Code.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Microsoft VS Code", "bin", "code.cmd"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Microsoft VS Code", "bin", "code.cmd"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft VS Code", "bin", "code.cmd"),
    ]

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            _VSCODE_COMMAND = candidate
            return candidate

    return None


def _open_in_vscode(abs_path: str, line: int, column: int) -> tuple[bool, str]:
    command = _find_vscode_command()
    target = f"{abs_path}:{line}:{column}"

    if not command:
        return False, "找不到 VS Code 命令列程式，無法自動開啟檔案。"

    cmdline: list[str]
    if command.lower().endswith(".cmd"):
        cmdline = ["cmd.exe", "/c", command, "--reuse-window", "--goto", target]
    else:
        cmdline = [command, "--reuse-window", "--goto", target]

    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

    try:
        subprocess.Popen(
            cmdline,
            cwd=str(Path(abs_path).parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )
    except Exception as exc:
        log.exception("Failed to open file in VS Code: %s", abs_path)
        return False, f"無法自動開啟 VS Code：{exc}"

    return True, ""


def _offset_to_line_column(line_starts: list[int], offset: int) -> tuple[int, int]:
    left = 0
    right = len(line_starts) - 1

    while left <= right:
        middle = (left + right) // 2
        line_start = line_starts[middle]
        next_start = line_starts[middle + 1] if middle + 1 < len(line_starts) else 10**18
        if line_start <= offset < next_start:
            return middle + 1, (offset - line_start) + 1
        if offset < line_start:
            right = middle - 1
        else:
            left = middle + 1

    last_index = max(0, len(line_starts) - 1)
    return last_index + 1, 1


def _line_starts(text: str) -> list[int]:
    starts = [0]
    starts.extend(match.end() for match in re.finditer(r"\n", text))
    if starts[-1] != len(text):
        starts.append(len(text))
    return starts


def _is_ignored_char(char: str) -> bool:
    return char in {"\u200b", "\u200c", "\u200d", "\ufeff"}
