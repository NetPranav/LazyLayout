### Fixed

- **Zoom shortcuts zoom around the mouse.** Cmd/Ctrl + and Cmd/Ctrl − (and the zoom buttons) now step the zoom around the point under the mouse when it is over the canvas, and around the middle of the canvas otherwise. They no longer jump the page back to the middle. Each step is still sized from the current zoom (it snaps to 100% when a step crosses it). Ctrl/Cmd + wheel (and a trackpad pinch) also zoom around the mouse now, instead of around the page's middle.
- **The canvas cursor stays drawn over the canvas's right-click menu.** Before, opening that menu and hovering it switched back to the system cursor. Other menus, opened from the top bar or panels, still use the system cursor.
