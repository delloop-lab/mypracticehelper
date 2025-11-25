# Recording Issue Analysis

## Problem
When creating a recording in Voice Notes and assigning it to a client, the recording does not appear in the client card on the Clients page.

## Root Cause
The `data/recordings.json` file is empty (`[]`) even though there are 10 audio files in `data/recordings/` directory. This means:
- Audio files were saved successfully
- Recording metadata was NOT saved to `recordings.json`
- Client cards count recordings by filtering `recordings.json` by `clientName`
- Since `recordings.json` is empty, all clients show 0 recordings

## Data State
- **recordings.json**: `[]` (empty)
- **recordings folder**: 10 `.webm` files exist
  - 1763811345084.webm
  - 1763811917394.webm
  - 1763813327148.webm
  - 1763813350344.webm
  - 1763813589010.webm
  - 1763813870952.webm
  - 1763813896439.webm
  - 1763814156290.webm
  - 1763814277141.webm
  - 1763814473263.webm

## Code Flow Analysis

### Recording Creation Flow:
1. **voice-notes.tsx** (line 117-166): `startRecording()` - Starts recording
2. **voice-notes.tsx** (line 169-179): `stopRecording()` - Stops and calls `processTranscript()`
3. **voice-notes.tsx** (line 182-237): `processTranscript()` - Processes and calls `saveRecording()`
4. **voice-notes.tsx** (line 240-260): `saveRecording()` - POSTs to `/api/recordings`
5. **api/recordings/route.ts** (line 13-46): POST handler - Saves audio file and metadata

### Assignment Flow:
1. **voice-notes.tsx** (line 311-350): `confirmSaveToClient()` - Saves notes to client
2. **voice-notes.tsx** (line 336): Calls `assignRecordingToClient(updatedClient.name)`
3. **voice-notes.tsx** (line 291-308): `assignRecordingToClient()` - Updates recording with clientName
4. **voice-notes.tsx** (line 304): Dispatches 'recordings-updated' event

### Display Flow:
1. **clients/page.tsx** (line 123-133): `loadRecordings()` - Fetches from `/api/recordings`
2. **clients/page.tsx** (line 135-137): `getRecordingCount()` - Filters by clientName
3. **clients/page.tsx** (line 720): Displays count in client card

## Potential Issues

1. **API POST might be failing silently** - The saveRecording function doesn't handle errors or check response
2. **Timing issue** - The setTimeout in stopRecording (line 178) might not be enough
3. **Missing await** - The saveRecording call on line 236 is not awaited
4. **Lost data** - Recordings were created before the API was properly set up (localStorage era)

## Solution Required

1. **Fix the save flow** - Ensure new recordings are properly saved
2. **Recover lost data** - Cannot recover metadata for existing recordings (no transcript/notes stored)
3. **Test the flow** - Create a new recording and verify it appears in recordings.json
