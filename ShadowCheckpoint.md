# ShadowCheckpointService Technical Report

## Overview

The ShadowCheckpointService is an abstract class that provides checkpoint functionality for code workspaces using Git as the underlying storage mechanism. It creates a "shadow" Git repository to track changes without interfering with the main workspace's Git repository.

## Core Components

### 1. Storage Structure

- **Checkpoints Directory**: A dedicated directory for storing checkpoints
- **Workspace Directory**: The actual workspace being tracked
- **Shadow Git Repository**: A separate Git repository that tracks the workspace state

### 2. Key Features

#### Initialization

- Creates a shadow Git repository if it doesn't exist
- Configures Git settings:
    - Sets core.worktree to the workspace directory
    - Disables commit signing
    - Sets default user credentials
- Handles nested Git repositories by temporarily disabling them
- Creates initial commit of the workspace state

#### Checkpoint Management

- **Saving Checkpoints**:

    - Stages all changes in the workspace
    - Creates a commit with the provided message
    - Maintains a list of checkpoint hashes
    - Emits events for checkpoint creation

- **Restoring Checkpoints**:
    - Cleans untracked files
    - Resets to the specified commit hash
    - Updates the checkpoint list
    - Emits restore events

#### Diff Generation

- Compares checkpoints or working tree states
- Provides detailed file-by-file differences
- Handles both tracked and untracked files
- Returns structured diff information including:
    - Relative and absolute file paths
    - Before and after content

### 3. Storage Strategies

The service supports two storage strategies:

1. **Task-specific Storage**: Dedicated checkpoint repository per task
2. **Workspace Storage**: Shared checkpoint repository per workspace with task-specific branches

## Event System

The service implements an event emitter with the following events:

- `initialize`: When the shadow Git repository is initialized
- `checkpoint`: When a new checkpoint is created
- `restore`: When a checkpoint is restored
- `error`: When operations fail

## Security Features

- Prevents checkpoint creation in protected directories (Desktop, Documents, Downloads, Home)
- Handles nested Git repositories safely
- Maintains separation between workspace and checkpoint storage

## Adding Last Verified Checkpoint Feature

The Last Verified Checkpoint feature replaces the previous `savePointHash` functionality by automatically tracking the first checkpoint as verified and providing methods to manage this state. This is useful for tracking known good states or verified versions of the code.

### Implementation Details

1. **Storage**:

    - In-memory storage using `protected _lastVerifiedCheckpoint?: string`
    - Persistent storage using Git config with key `roo.lastVerifiedCheckpoint`
    - Synchronized between memory and Git config for reliability
    - Replaces the previous `savePointHash` variable in the `Cline` class

2. **Methods**:

    ```typescript
    // Get the verified checkpoint (replaces getSavePointHash)
    public async getVerifiedCheckpoint(): Promise<string | undefined>

    // Reset the verified checkpoint (replaces clearLastVerifiedCheckpoint)
    public async resetVerifiedCheckpoint()
    ```

3. **Automatic Verification**:

    - The first checkpoint is automatically set as verified (replaces the old event listener that set savePointHash)
    - Subsequent checkpoints can be verified by calling `resetVerifiedCheckpoint()` followed by `saveCheckpoint()`
    - The verified state persists between sessions using Git config

4. **Error Handling**:
    - All methods require initialized shadow Git repository
    - Proper error propagation through event system
    - Detailed logging for debugging

### Usage Examples

```typescript
// Initialize the service
const checkpointService = new ShadowCheckpointService(
	"task-123",
	"/path/to/checkpoints",
	"/path/to/workspace",
	console.log,
)

// Initialize the shadow Git repository
await checkpointService.initShadowGit()

// Save a checkpoint (first checkpoint will be automatically verified)
const result = await checkpointService.saveCheckpoint("Initial state")

// Get the current verified checkpoint
const verifiedCheckpoint = await checkpointService.getVerifiedCheckpoint()
if (verifiedCheckpoint) {
	console.log(`Current verified checkpoint: ${verifiedCheckpoint}`)
}

// Reset the verified checkpoint
await checkpointService.resetVerifiedCheckpoint()

// Save a new checkpoint (will be automatically verified since we reset)
await checkpointService.saveCheckpoint("New verified state")
```

### Integration Points

1. **Event System**:

    - The service emits error events for all operations
    - Checkpoint events include verification status

2. **Git Config**:

    - Uses Git config for persistence
    - Survives between sessions
    - Maintains consistency across operations

3. **Error Handling**:
    - All operations are wrapped in try-catch blocks
    - Errors are logged and emitted
    - Operations fail gracefully with proper error messages

### Best Practices

1. **Verification Timing**:

    - First checkpoint is automatically verified
    - Reset verification when you want to mark a new checkpoint as verified
    - Use `resetVerifiedCheckpoint()` followed by `saveCheckpoint()` to change verification

2. **Error Handling**:

    - Always check for initialization before operations
    - Handle potential errors in async operations
    - Use event listeners for error tracking

3. **State Management**:
    - Keep verification status in sync with actual code state
    - Reset verification when making significant changes
    - Use verification status for comparison and rollback

## Best Practices for Implementation

1. **Error Handling**:

    - Always wrap Git operations in try-catch blocks
    - Provide detailed error messages
    - Emit error events for proper error propagation

2. **Performance Considerations**:

    - Use efficient Git operations
    - Minimize file system operations
    - Cache frequently accessed data

3. **State Management**:
    - Maintain consistent state between checkpoints
    - Handle concurrent operations safely
    - Clean up resources properly

## Usage Example

```typescript
const checkpointService = new ShadowCheckpointService(
	"task-123",
	"/path/to/checkpoints",
	"/path/to/workspace",
	console.log,
)

// Initialize
await checkpointService.initShadowGit()

// Save checkpoint
await checkpointService.saveCheckpoint("Initial state")

// Get diff
const diff = await checkpointService.getDiff({
	from: "initial-commit",
	to: "HEAD",
})

// Restore checkpoint
await checkpointService.restoreCheckpoint("commit-hash")
```

## Future Improvements

1. **Performance Optimizations**:

    - Implement checkpoint compression
    - Add incremental checkpoint storage
    - Cache frequently accessed checkpoints

2. **Feature Enhancements**:

    - Add checkpoint metadata storage
    - Implement checkpoint tagging
    - Add checkpoint search functionality
    - Add checkpoint comparison tools

3. **Integration Features**:
    - Add support for remote checkpoint storage
    - Implement checkpoint sharing
    - Add checkpoint export/import functionality

## Conclusion

The ShadowCheckpointService provides a robust foundation for managing code checkpoints. Its architecture allows for flexible storage strategies and efficient state management. The service is well-designed for extensibility, making it possible to add features like last verified checkpoint tracking without major architectural changes.
