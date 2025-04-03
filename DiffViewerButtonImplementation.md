# Diff Viewer Button Implementation and Auto-Diff Functionality

## Overview

Documents the implementation of the button that opens the diff viewer in the chat interface.

## UI Components

### 1. Chat Input Button

- **Location**: `webview-ui/src/components/chat/ChatTextArea.tsx`
- **Type**: `IconButton` (lines 1092-1107)
- **Properties**:
    - `iconClass`: "codicon-git-compare" (Git compare icon)
    - `title`: Localized string key "chat:viewGitDiff"
    - `disabled`: Tied to text area disabled state
    - `onClick`: Handler that sends "checkpointDiffWeb" message with:
        - `previousCommitHash`: undefined (diffs against working tree)
        - `mode`: "checkpoint"

### 2. Checkpoint Menu Button

- **Location**: `webview-ui/src/components/chat/checkpoints/CheckpointMenu.tsx`
- **Type**: `Button` (lines 51-57)
- **Properties**:
    - `variant`: "ghost"
    - `size`: "icon"
    - `title`: Localized string key "chat:checkpoint.menu.viewDiff"
    - `onClick`: Handler that sends "checkpointDiffWeb" message with:
        - `previousCommitHash`: From checkpoint metadata
        - `commitHash`: Current checkpoint hash
        - `mode`: "checkpoint"

## Message Flow

### 1. From Chat Input Button

```typescript
vscode.postMessage({
	type: "checkpointDiffWeb",
	payload: {
		ts: Date.now(),
		previousCommitHash: undefined, // Diff against working tree
		mode: "checkpoint",
	},
})
```

### 2. From Checkpoint Menu Button

```typescript
vscode.postMessage({
	type: "checkpointDiffWeb",
	payload: {
		ts,
		previousCommitHash, // From checkpoint metadata
		commitHash, // Current checkpoint hash
		mode: "checkpoint",
	},
})
```

### 3. Automatic On Task Completion

```typescript
// In Cline.ts after task completion
await this.checkpointDiff({
	ts: Date.now(),
	previousCommitHash: undefined, // Same as chat button
	mode: "checkpoint", // Same as chat button
})
```

2. **Extension Handling** (in `ClineProvider.ts`):

    - Message received in `handleWebviewMessage` (line 1206)
    - Validates and processes payload
    - Calls `cline.checkpointDiff()` with parameters

3. **Diff Processing** (in `Cline.ts`):
    - `checkpointDiff()` method (line 3992)
    - Retrieves verified checkpoint
    - Generates diff between checkpoint and current state
    - Opens diff views for each changed file

## Technical Deep Dive

### Diff Generation Process

1. **Input Collection**:
    - For working tree diffs: Gets current file states from memory
    - For commit diffs: Retrieves file states from git object store
2. **Comparison**:
    - Uses git's diff algorithm for line-by-line comparison
    - Handles binary files separately with size/checksum comparison
3. **Presentation**:
    - Creates temporary files for each version
    - Opens VSCode's diff editor with:
        - Left side: Previous version
        - Right side: Current version
4. **Cleanup**:
    - Watches editor close events
    - Deletes temporary files after diff is closed

### Workflow Diagram

```
[Webview]                          [Extension]                          [Git/VSCode]
   |                                    |                                    |
   | 1. postMessage(checkpointDiffWeb)  |                                    |
   |----------------------------------->|                                    |
   |                                    | 2. validate payload                |
   |                                    |----------------------------------->|
   |                                    | 3. getCommitData(hashes)           |
   |                                    |<-----------------------------------|
   |                                    | 4. generateDiff()                  |
   |                                    |----------------------------------->|
   |                                    | 5. createTempFiles()               |
   |                                    | 6. openDiffEditor()                |
   |                                    |<-----------------------------------|
   | 7. receive diffComplete message    |                                    |
   |<-----------------------------------|                                    |
```

## Example Scenarios

### Scenario 1: Manual Diff from Chat

1. User clicks diff button in chat interface
2. System diffs against current working tree
3. Shows all changed files since last checkpoint
4. User can review and accept/reject changes

### Scenario 2: Auto-Diff on Task Completion

1. Task finishes successfully
2. System automatically:
    - Gets hashes for current and previous checkpoints
    - Generates diff between them
    - Opens diff view for each changed file
3. User sees exactly what changed during task execution

## Performance Considerations

1. **Memory Usage**:
    - Large diffs are chunked (max 50 files at once)
    - Binary files >5MB are excluded by default
2. **Speed Optimizations**:
    - Parallel diff generation for multiple files
    - Caching of frequently accessed commits
3. **User Experience**:
    - Progress indicators during large diff generation
    - Ability to cancel long-running diff operations
    - Configurable timeout (default 30s)

## Key Functions

1. **Webview**:

    - `vscode.postMessage()` - Sends message to extension
    - Localization lookup for button titles
    - Checkpoint metadata handling (CheckpointMenu.tsx)

2. **Extension**:
    - `ClineProvider.handleWebviewMessage()` - Message routing
    - `Cline.checkpointDiff()` - Core diff logic with two modes:
        - Working tree diff (when previousCommitHash is undefined)
        - Commit-to-commit diff (when both hashes provided)
    - `ShadowCheckpointService.getDiff()` - Actual diff generation
    - `ShadowCheckpointService.getVerifiedCheckpoint()` - Retrieves checkpoint state

## Integration Points

1. **With Git**:

    - Uses git to get commit hashes
    - Generates diffs between commits/working tree
    - Can be triggered automatically on task completion

2. **With Webview State**:

    - Updates webview when diff completes
    - Sends "currentCheckpointUpdated" messages
    - Listens for task completion events

3. **With VSCode API**:
    - Uses VSCode's diff editor
    - Manages temporary files
    - Handles editor lifecycle

## Auto-Diff Implementation

To automatically open the diff viewer on task completion:

1. **Trigger Point**:

    - In `Cline.ts` when calling `finishSubTask()`
    - After confirming task completed successfully

2. **Logic**:

```typescript
// After task completion in Cline.ts
if (shouldShowDiffOnCompletion) {
	const currentHash = getCurrentCommitHash()
	const previousHash = getPreviousCheckpointHash()

	this.checkpointDiff({
		ts: Date.now(),
		previousCommitHash: previousHash,
		commitHash: currentHash,
		mode: "auto",
	})
}
```

3. **Configuration**:
    - Add setting to control auto-diff behavior
    - Only trigger when changes exist
    - Respect user preferences

## Error Handling

- Checks for valid checkpoint
- Handles missing git history
- Manages concurrent diff views
- Cleans up resources on errors

## Dependencies

- VSCode extension host API
- Git integration
- Webview message protocol
- Localization system
