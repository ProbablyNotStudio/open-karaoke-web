# Open Karaoke

**Live website:** [https://probablynotstudio.github.io/open-karaoke-web/](https://probablynotstudio.github.io/open-karaoke-web/)

Select **Settings → MIDI SoundFont → Enhanced synth (no download)** for the second procedural instrument player. It has 128 GM program recipes, velocity-sensitive tone, generated piano/mallet decays, physical plucked-string textures, seamless sustained instrument bodies, and a separate generated drum kit, a louder compressed mix with peak limiting, and per-program sustain/release tuning informed by Timbres of Heaven, KaraOke King v2 and Yamaha XG. No recordings from those banks are included in this synth. Their sample envelopes also contain behavior inherent to recorded audio, so procedural envelopes are adapted rather than copied literally. Textures are generated locally and kept in an 8 MiB cache. One audio source per note limits playback overhead. The classic synth and sampled SoundFonts remain available.


Settings shows saved file sizes for songs/lyrics, SoundFonts (including downloaded banks), and background videos, with separate cleanup controls. Browser usage and allowance are estimates for this website, including caches; they are not the device's total disk capacity. Measurement reads file metadata in bounded pages, not audio contents.

Queues are saved as song IDs in this browser and restored after the local library loads. Repeated songs represent separate turns. Use the up/down buttons to reorder and × to remove one turn. The fullscreen Songs button is hidden in the regular player. On touch devices, fullscreen search uses a built-in number pad, with ABC for title/artist searches, so the phone keyboard stays closed. Exact song numbers accept different leading-zero padding. Reserve and Play now require a unique matching number; ambiguous numbers stay in the result list for explicit selection.

On mobile fullscreen, the video/lyrics occupy the top row and the search keypad occupies a separate bottom row. The panel is nonmodal, stays open when starting a song, and includes pause, next and stop controls. Closing the panel returns the full picture; Songs opens it again. Desktop fullscreen retains its side panel.

Large-library browsing caches at most three metadata result lists and narrows existing matches as a query grows. Imports and changed MIDI metadata invalidate them; edited favorites are checked separately. Saved metadata is prepared in batches of 200 while new files and ZIP imports retain batches of 25. Audio contents remain lazy and storage reads retain their existing limits. Versioned app assets reuse the current release cache; HTML still checks for updates. Run `node tools/benchmark-library.js` for the synthetic 50,000-song pagination benchmark.
