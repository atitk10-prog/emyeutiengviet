EM YEU TIENG VIET - HUONG DAN GIAO PROMPT CHO CODING AGENT

1) Chep file EMYTV_AGENT_PROMPT.md (hoac AGENTS.md) vao THU MUC GOC cua du an.

2) Neu dung Terminal PowerShell tren Windows, doc noi dung prompt:
   Get-Content -Raw -Encoding UTF8 .\EMYTV_AGENT_PROMPT.md

3) Neu dung Linux/macOS/Git Bash:
   cat ./EMYTV_AGENT_PROMPT.md

4) Gui cho Coding Agent trong du an (Cursor/Antigravity/Claude Code...):
   "Hay doc TOAN BO file EMYTV_AGENT_PROMPT.md va EMYTV_QA_CHECKLIST.md
   tai thu muc goc. Thuc hien lap trinh ngay theo P0 -> P4, khong chi
   dua ra ke hoach, khong dung mock thay Firebase. Sau moi buoc hay
   chay test va sua loi; cuoi cung ghi QA_REPORT.md thuc te."

5) Mot so agent tu dong doc AGENTS.md trong thu muc goc; co the su dung
   ten file AGENTS.md da cung cap.

6) Neu chua co Firebase Project/API Key: yeu cau Agent lam tren Firebase
   Emulator va che do tao bai thu cong; khong tu nhan da deploy.

7) Sau khi Agent hoan thanh, doi chieu EMYTV_QA_CHECKLIST.md.
