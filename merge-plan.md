# Merge Plan: Integrating roo_cursor Improvements into Modular Structure

## Overview

The codebase has evolved in two divergent directions:

1. **Main Branch**: Refactored tool implementations into separate modular files (added March 2025)
2. **roo_cursor Branch**: Enhanced functionality with inline tool implementations (started July 2024)

This plan outlines how to merge these branches while:

- Preserving the modular architecture from main
- Retaining all functional improvements from roo_cursor

## Key Improvements in roo_cursor Branch

1. Enhanced diff viewing with new `DiffApproveProvider`
2. Checkpoint verification mechanisms
3. Improved error handling and logging
4. OS-specific context handling
5. Various tool implementation enhancements

## Step 1: Resolve Merge Conflicts

Accept the modular structure from main and clear all merge conflict markers.

```bash
git checkout main                        # Start from main branch
git merge roo_cursor --no-commit         # Attempt merge without committing
# Manually resolve conflicts, accepting modular structure from main
git add .                                # Add resolved files
git commit -m "Merge roo_cursor, accepting modular structure"
```

## Step 2: Port Core Class Improvements

### 2.1 Checkpoint and Diff Functionality

Update the main Cline.ts file with the improved checkpoint functionality:

```typescript
// In src/core/Cline.ts

// Add DiffApproveProvider import
import { DIFF_APPROVE_URI_SCHEME, DiffApproveProvider } from "../integrations/diff-approve/DiffApproveProvider"

// Replace checkpointDiff method with enhanced version from roo_cursor
public async checkpointDiff({
    ts,
    previousCommitHash,
    commitHash,
    mode,
}: {
    ts: number
    commitHash?: string
    previousCommitHash?: string
    mode: "full" | "checkpoint"
}) {
    console.log(`[Cline] ============================================`)
    console.log(`[Cline] === CHECKPOINT DIFF METHOD CALLED DIRECTLY ===`)
    console.log(`[Cline] ============================================`)
    console.log(`[Cline] checkpointDiff params:`, { ts, previousCommitHash, commitHash, mode })

    // ... rest of implementation from roo_cursor branch
}

// Update checkpointSave method to be async
public async checkpointSave() {
    // ... implementation from roo_cursor branch
}

// Add getVerifiedCheckpoint method
public async getVerifiedCheckpoint(): Promise<string | undefined> {
    const service = this.getCheckpointService()
    if (service) {
        return await service.getVerifiedCheckpoint()
    }
    return undefined
}

// Add escapeRegExp helper function
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
```

### 2.2 OS-Specific Context Handling

Update the mentions parsing to include OS info:

```typescript
// In src/core/Cline.ts - update mentions parsing in initiateTaskLoop

// Replace the parseMentions calls with the updated versions that include OS info
const { osInfo } = (await this.providerRef.deref()?.getState()) || { osInfo: "unix" }

text: await parseMentions(block.text, this.cwd, this.urlContentFetcher, osInfo),
```

## Step 3: Update Tool Implementations

For each tool with improvements, port those changes to the corresponding modular file.

### 3.1 attemptCompletionTool.ts

```typescript
// In src/core/tools/attemptCompletionTool.ts

// Look for differences like auto-opening diff viewer and add them to the modular implementation:
// Example:
if (cline.parentTask) {
	const didApprove = await askFinishSubTaskApproval()

	if (!didApprove) {
		break
	}
	// tell the provider to remove the current subtask and resume the previous task in the stack
	await cline.providerRef.deref()?.finishSubTask(`Task complete: ${lastMessage?.text}`)
}

console.log("************************* TASK COMPLETE *************************")
// Auto-open diff viewer (same behavior as chat button)
try {
	await cline.checkpointDiff({
		ts: Date.now(),
		previousCommitHash: undefined, // Diff against working tree
		mode: "checkpoint",
	})
} catch (error) {
	console.warn("Failed to auto-open diff viewer:", error)
}
```

### 3.2 Update All Other Tool Files

For each remaining tool with improvements:

1. Identify the changes in roo_cursor branch
2. Locate the corresponding tool file
3. Port the changes to the modular file

Focus on these specific tools which likely have improvements:

- `use_mcp_tool`
- `access_mcp_resource`
- `ask_followup_question`
- `switch_mode`
- `new_task`

## Step 4: Create or Update the DiffApproveProvider

Create or update the DiffApproveProvider component:

```bash
# If it doesn't exist yet
mkdir -p src/integrations/diff-approve
touch src/integrations/diff-approve/DiffApproveProvider.ts
```

```typescript
// src/integrations/diff-approve/DiffApproveProvider.ts
// Implement the DiffApproveProvider based on roo_cursor branch
import * as vscode from "vscode"
// ...rest of the implementation
```

## Step 5: Ensure All Dependencies Are Updated

```typescript
// Ensure any new dependencies or imports are properly included
import delay from "delay"
// ... other imports
```

## Step 6: Testing

Test each component incrementally:

1. **Core Cline Class Functions**:

    - Test checkpoint operations
    - Verify diff viewer functionality
    - Ensure OS-specific context handling

2. **Each Tool Implementation**:

    - Test that each tool works as expected
    - Verify that improvements from roo_cursor are maintained

3. **Integration Tests**:
    - Run through complete workflows to ensure components interact correctly

## Final Review

- Ensure code style consistency across the codebase
- Check for any remaining references to inline tool implementations
- Verify all tests pass after the changes
- Check for any duplicated code that could be refactored

## Troubleshooting

If issues arise during integration:

1. Compare with the original roo_cursor implementation
2. Check for any dependencies or interactions missed during the port
3. Verify that the original functionality is maintained
