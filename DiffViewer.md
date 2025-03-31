# Diff Viewer Technical Documentation

## Overview

The diff viewer is a feature that allows users to compare their current workspace state with a verified checkpoint. It provides a visual interface for reviewing changes and selectively approving or rejecting modifications.

## Core Components

### 1. Checkpoint Management

The diff viewer relies on the Last Verified Checkpoint feature to track which checkpoint to compare against:

```typescript
// In ShadowCheckpointService.ts
public async saveCheckpoint(message: string): Promise<CheckpointResult | undefined> {
    // ...
    if (isFirst || result.commit) {
        this.emit("checkpoint", { type: "checkpoint", isFirst, fromHash, toHash, duration })

        // If this is the first checkpoint or no verified checkpoint exists, set it as verified
        if (isFirst || !this._lastVerifiedCheckpoint) {
            await this.setLastVerifiedCheckpoint(toHash)
        }
    }
    // ...
}
```

### 2. Diff Viewer Flow

#### Initialization

1. User initiates diff view through the webview UI
2. Webview sends `checkpointDiff` message to extension
3. Extension retrieves current verified checkpoint
4. If no verified checkpoint exists, shows error message
5. Otherwise, proceeds with diff generation

```typescript
// In Cline.ts
public async checkpointDiff({ ts, previousCommitHash, commitHash, mode }: {
    // ...
    if (!commitHash || commitHash === "HEAD") {
        const verifiedCheckpoint = await service.getVerifiedCheckpoint()
        if (!verifiedCheckpoint) {
            console.log("[checkpointDiff] No verified checkpoint found, cannot perform diff")
            vscode.window.showInformationMessage("No checkpoint hash available for diff view.")
            return
        }
        commitHash = verifiedCheckpoint
    }
    // ...
})
```

#### Diff Generation

1. Retrieves changes between verified checkpoint and current state
2. Creates temporary files for old versions
3. Shows diff UI for each changed file
4. Tracks number of active diff views

```typescript
// In Cline.ts
const changes = await service.getDiff({ from: previousCommitHash, to: commitHash })
let activeViews = changes.length

// Show each change in the diff approve view
for (const change of changes) {
	// Create temporary files and show diff UI
	// ...
}
```

#### User Interaction

1. User can approve or reject changes block by block
2. Approved changes remain in the workspace
3. Rejected changes are reverted to the original state
4. Each diff view tracks its own state

```typescript
// In Cline.ts
;async (blockId: number, approved: boolean) => {
	if (approved) {
		vscode.window.showInformationMessage(`Block ${blockId} in ${change.paths.relative} approved`)
	} else {
		// For denied blocks, revert that block in the working file
		const blocks = provider.findRelatedBlocks(blockId)
		if (blocks.length > 0) {
			// Revert changes...
		}
	}
}
```

#### Cleanup

1. When all diff views are closed:
    - Cleans up temporary files
    - Resets the verified checkpoint
    - Updates webview UI

```typescript
// In Cline.ts
if (activeViews === 0) {
	console.log("[checkpointDiff] All diff views closed, resetting verified checkpoint")
	const service = this.getCheckpointService()
	if (service) {
		await service.resetVerifiedCheckpoint()
	}

	const provider = this.providerRef.deref()
	if (provider) {
		provider.log("[checkpointDiff] All diff views closed, verified checkpoint reset")
		provider.postMessageToWebview({ type: "currentCheckpointUpdated", text: "" })
	}
}
```

## Integration Points

### 1. Webview UI

- `CheckpointMenu.tsx`: Provides UI for initiating diff view
- `CheckpointSaved.tsx`: Shows checkpoint status and actions
- `ExtensionStateContext.tsx`: Manages checkpoint state in webview

### 2. Extension

- `Cline.ts`: Core diff viewer implementation
- `ClineProvider.ts`: Handles webview communication
- `ShadowCheckpointService.ts`: Manages checkpoints and diffs

### 3. State Management

- Verified checkpoint state is maintained in Git config
- Webview state is updated through `currentCheckpointUpdated` messages
- Diff view state is tracked per file and block

## Event Flow

1. **Checkpoint Creation**:

    - First checkpoint is automatically set as verified
    - Subsequent checkpoints require manual verification

2. **Diff View Initiation**:

    - Webview → Extension: `checkpointDiff` message
    - Extension → CheckpointService: Get verified checkpoint
    - CheckpointService → Extension: Return changes

3. **User Interaction**:

    - User → Diff UI: Approve/Reject changes
    - Diff UI → Extension: Update workspace
    - Extension → Webview: Update UI state

4. **Cleanup**:
    - Diff View → Extension: Close notification
    - Extension → CheckpointService: Reset verified checkpoint
    - Extension → Webview: Update checkpoint state

## Best Practices

1. **State Management**:

    - Always verify checkpoint state before operations
    - Clean up temporary files after use
    - Reset verified checkpoint after diff view closes

2. **Error Handling**:

    - Handle missing checkpoints gracefully
    - Provide clear error messages to users
    - Clean up resources on errors

3. **Performance**:
    - Use temporary files for old versions
    - Clean up resources promptly
    - Handle large diffs efficiently

## Future Improvements

1. **UI Enhancements**:

    - Add diff statistics
    - Improve block selection
    - Add batch operations

2. **Performance**:

    - Implement diff caching
    - Optimize temporary file handling
    - Add progress indicators

3. **Features**:
    - Add diff history
    - Support multiple diff views
    - Add diff export/import
