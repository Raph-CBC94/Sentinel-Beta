---
name: Conversation transfer files
description: Where files from the temporary conversation workspace can be found after a project handoff.
---

After a conversation is moved into a project, files created or uploaded before the move may be preserved under `.local/conversation-workspace/files` instead of the project root.

**Why:** The project scaffold can start successfully while the user's actual source files are still outside the active project tree.

**How to apply:** Before implementing a transferred request, search that directory for the uploaded source and restore only the relevant project files into the root; do not copy the preserved tool cache or temporary conversation metadata.