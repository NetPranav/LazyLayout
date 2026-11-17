### Fixed

- **The editor no longer freezes when anything is animated.** Since the selection-box fix of #206, opening Motion, playing or previewing an animated page hung the tab until the browser offered to stop it.
  - The canvas watched the page for style changes and measured it again after each one. Every measurement takes the animation off the layers and puts it back, which is itself a style change, so it set itself off without end.
  - A measurement now drops the changes it made itself.
  - The animation engine's own writes are no longer measured: playback, scrubbing, drivers and states move a layer's animated pose, never where it rests.
  - Measurements the page watcher asks for run at most once a frame, after the engine has drawn, so nothing it does can keep the page from painting.
- Selection boxes still follow a layer whose drawn box changes with no document change (a picture or a font arriving, auto layout, grid).
