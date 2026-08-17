# Commissioned Module Update

This module was updated as part of a commission. Any further updates beyond new core compatibility is subject to a monetary contribution. Issues for new features will be assigned a value based on complexity.

# Video Game Music

![GitHub release](https://img.shields.io/github/v/release/Sayshal/vgmusic?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](<https://img.shields.io/github/downloads/Sayshal/vgmusic/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f>)
![GitHub Downloads (specific asset, latest release)](<https://img.shields.io/github/downloads/Sayshal/vgmusic/latest/module.zip?sort=date&style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Latest)&color=ff144f>)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Fvgmusic%2Freleases%2Flatest%2Fdownload%2Fmodule.json)

## Supporting The Module

[![Discord](https://dcbadge.limes.pink/api/server/PzzUwU9gdz)](https://discord.gg/PzzUwU9gdz)

## Overview

Video Game Music adds context-aware music to FoundryVTT. It automatically switches between area and combat music based on game state, tracks playback position so music resumes where it left off, and crossfades between tracks.

## Features

- **Area & Combat Music** — assign playlists per-scene for exploration and combat
- **Per-Token Themes** — give individual tokens their own combat music via Token Config
- **Priority System** — control which music wins when multiple sources apply
- **Fallback Modes** — configurable behavior when the active combatant has no theme
- **Crossfade** — adjustable fade duration for smooth transitions between tracks
- **Position Memory** — tracks resume from where they were interrupted
- **Suppression** — toggle area or combat music on/off with hotkeys or scene controls

## Installation

Install through Foundry's module browser, or paste the manifest URL:

```
https://github.com/Sayshal/vgmusic/releases/latest/download/module.json
```

## Setup

1. **Scene music** — open Scene Config, click the music configuration button to assign area and combat playlists
2. **Token music** — open Token Config (or Prototype Token), find the music button in the Identity tab to assign combat themes
3. **Linked token override** — linked tokens can optionally use their own music instead of the actor's prototype config
4. **Default music** — set a world-level fallback in module settings
5. **Settings** — configure silent combat mode, fade duration, and suppression hotkeys

## Settings

| Setting                  | Description                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Silent Combat Music Mode | What plays when the active combatant has no theme (highest priority, last actor, area music, or generic combat) |
| Fade Duration            | Crossfade time in seconds (0 = use per-sound fade)                                                              |
| Default Music            | World-level fallback combat playlist                                                                            |

## Support

- [Discord](https://discord.gg/PzzUwU9gdz)
- [GitHub Issues](https://github.com/Sayshal/vgmusic/issues)
