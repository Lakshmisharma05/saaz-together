
## What's being added

### 1. Solo listening mode
A one-person player, no invite, no chat. Reachable from the dashboard via a "Listen Solo" button and a new `/solo` route.

- Reuses the existing search + YouTubePlayer.
- Writes to `play_history` so your history keeps building.
- Shows a "Go Live" toggle that opens the Live Song Room (see #4) for whatever's playing.

### 2. Jam session (new room type)
Rooms get a `mode` column: `listen` (current behavior — host picks tracks) or `jam` (collaborative queue).

- Dashboard's "Start a session" gets a mode toggle: **Listen together** vs **Jam session**.
- Jam rooms show a shared **Up Next** queue in the right rail. Any participant can add a track from search, reorder by drag, or remove.
- When the current track ends (or someone hits Skip), the room advances to the next queue item automatically.
- Invite links work the same — friends can join an existing room and it becomes a jam if that's its mode.

### 3. Video call inside a room
A "Start video" button in any room (listen or jam) opens a peer-to-peer WebRTC grid above the chat.

- Uses Supabase Realtime as the signaling channel (offer/answer/ICE broadcast on `room:{id}:rtc`).
- Camera + mic toggles, mute/leave controls, tile grid for up to ~4 participants (P2P mesh limit).
- Music keeps playing in sync while the call is up; participants can talk over it.
- Leaving the room or closing video tears down the peer connections cleanly.

### 4. Live Song Rooms (solo taste-match chat)
When you're in Solo mode you can tap **Live** on the now-playing bar to join a public chat with everyone currently listening to the exact same YouTube video.

- New route `/live/$videoId` — grid of listener avatars + ephemeral chat.
- Uses Supabase Realtime presence (keyed by `video_id`) to show who's here, and broadcast messages for chat.
- Nothing is persisted — chat exists only while the song is playing. When you skip/stop or the video ends, you leave the room automatically.
- Solo dashboard shows a "🔴 Live now" badge on tracks in your history that currently have other listeners.

## Technical notes

**Database migration**
- `rooms.mode text not null default 'listen'` with a check `mode in ('listen','jam')`.
- New `room_queue` table: `id, room_id, video_id, title, channel, thumbnail, position int, added_by, added_at`. RLS: participants of the room can select/insert/delete; only adder or host can delete.

**New server functions** (`src/lib/rooms.functions.ts`)
- `createRoom` gains a `mode` input.
- `addToQueue`, `removeFromQueue`, `reorderQueue`, `popNextFromQueue`.

**New files**
- `src/routes/_authenticated/solo.tsx` — solo player.
- `src/routes/_authenticated/live.$videoId.tsx` — live song room.
- `src/components/VideoCall.tsx` — WebRTC mesh using Supabase Realtime signaling.
- `src/components/QueueRail.tsx` — jam-room shared queue UI.
- `src/components/LiveBadge.tsx` — small presence counter for history rows.

**Edited files**
- `src/routes/_authenticated/room.$roomId.tsx` — wires queue rail (jam mode only), video-call panel, and "Live" link on the now-playing card.
- `src/routes/_authenticated/app.tsx` — mode toggle in the create-room form, "Listen Solo" CTA.
- `src/components/YouTubePlayer.tsx` — expose an `onEnded` callback so jam rooms auto-advance.

Nothing removed from the existing feature set — this is additive.
