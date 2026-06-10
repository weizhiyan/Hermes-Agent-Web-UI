#!/usr/bin/env python3
"""
Hermes Python Bridge - stdin/stdout JSON-Lines RPC.
Main thread reads stdin. Chats run on background thread.
"""
import io, json, os, signal, sys, threading, time
from pathlib import Path

SITE = r"C:\Program Files\Python312\Lib\site-packages"
if SITE not in sys.path:
    sys.path.insert(0, SITE)
from run_agent import AIAgent
import yaml

HERMES_HOME = Path.home() / ".hermes"
CONFIG_PATH = HERMES_HOME / "config.yaml"
MAX_RESULT = 10000

stop_event = threading.Event()


def read_config():
    if not CONFIG_PATH.is_file():
        return ""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    mc = cfg.get("model", {}) or {}
    return mc.get("default", "") or os.environ.get("HERMES_MODEL", "")


def emit(obj):
    try:
        sys.__stdout__.write(json.dumps(obj, ensure_ascii=False, default=str) + "\n")
        sys.__stdout__.flush()
    except (BrokenPipeError, OSError):
        stop_event.set()


def run_chat(msg: str, session_id: str):
    stop_event.clear()
    tool_times = {}
    model_name = read_config() or "deepseek-v4-flash"

    def on_start(tid, name, args):
        if stop_event.is_set():
            raise SystemExit("stopped")
        tool_times[tid] = time.time()
        emit({"type":"tool:start","id":tid,"name":name,"args":args})

    def on_progress(tid, name, content):
        if stop_event.is_set():
            raise SystemExit("stopped")
        emit({"type":"tool:output","id":tid,"name":name,"content":content})

    def on_complete(tid, name, args, result):
        if stop_event.is_set():
            return
        elapsed = time.time() - tool_times.pop(tid, time.time())
        r = str(result or "")
        if len(r) > MAX_RESULT:
            r = r[:MAX_RESULT] + "...（截断）"
        emit({"type":"tool:complete","id":tid,"name":name,"result":r,"duration":f"{elapsed:.1f}s"})

    def on_think(text):
        if text and not stop_event.is_set():
            emit({"type":"thinking","content":text})

    def on_text(text):
        if text and not stop_event.is_set():
            emit({"type":"text","content":text})

    # Capture AIAgent stdout (it prints init messages to sys.stdout)
    captured = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = captured

    try:
        agent = AIAgent(
            model=model_name,
            tool_start_callback=on_start,
            tool_progress_callback=on_progress,
            tool_complete_callback=on_complete,
            thinking_callback=on_think,
            quiet_mode=False,
        )
        agent.run_conversation(user_message=msg, stream_callback=on_text)
    except SystemExit:
        emit({"type":"error","content":"已停止"})
    except Exception as e:
        emit({"type":"error","content":f"{type(e).__name__}: {e}"})
    finally:
        sys.stdout = old_stdout
        emit({"type":"done","session_id":session_id})


def main():
    signal.signal(signal.SIGINT, lambda s,f: (stop_event.set(), sys.exit(130)))
    signal.signal(signal.SIGTERM, lambda s,f: (stop_event.set(), sys.exit(0)))

    chat_thread = None

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError:
            emit({"type":"error","content":"Invalid JSON"})
            continue

        action = cmd.get("action", "")

        if action == "ping":
            emit({"type":"pong"})

        elif action == "chat":
            if chat_thread and chat_thread.is_alive():
                emit({"type":"error","content":"已有对话在运行，请先 stop"})
                continue
            msg = cmd.get("message", "")
            sid = cmd.get("session_id", "")
            chat_thread = threading.Thread(target=run_chat, args=(msg, sid), daemon=True)
            chat_thread.start()

        elif action == "stop":
            stop_event.set()
            if chat_thread:
                chat_thread.join(timeout=5)

        elif action == "shutdown":
            stop_event.set()
            break

        else:
            emit({"type":"error","content":f"Unknown action: {action}"})


if __name__ == "__main__":
    main()
