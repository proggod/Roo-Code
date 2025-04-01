# Resolving the Cline.ts Merge Conflict

This document provides detailed steps to resolve the current merge conflict in `src/core/Cline.ts` while preserving both the modular structure from main and the functionality improvements from roo_cursor.

## Step 1: Accept Main's Modular Structure

First, resolve the merge conflicts by accepting the modular approach from the main branch:

1. Open `src/core/Cline.ts`
2. For each merge conflict, keep the HEAD version (from main branch) that uses the modular tool functions:

```typescript
// Example: Accept this pattern
case "write_to_file":
    await writeToFileTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
    break

// Instead of the inline implementation with { ... } blocks
```

3. Remove all merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
4. Make sure the file compiles without errors

## Step 2: Identify Functional Improvements

Extract the functional improvements from your roo_cursor branch:

### 2.1 DiffApproveProvider Integration

Create the DiffApproveProvider:

```bash
mkdir -p src/integrations/diff-approve
touch src/integrations/diff-approve/DiffApproveProvider.ts
```

Copy the DiffApproveProvider implementation from your branch to this new file.

### 2.2 Add the Import to Cline.ts

```typescript
// Add near the top of Cline.ts with other imports
import { DIFF_APPROVE_URI_SCHEME, DiffApproveProvider } from "../integrations/diff-approve/DiffApproveProvider"
```

## Step 3: Update Core Checkpoint Methods

Replace the checkpoint methods in Cline.ts with your enhanced versions:

### 3.1 checkpointDiff Method

```typescript
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
    // Copy the entire implementation from your roo_cursor branch
    console.log(`[Cline] ============================================`)
    console.log(`[Cline] === CHECKPOINT DIFF METHOD CALLED DIRECTLY ===`)
    console.log(`[Cline] ============================================`)
    // ...rest of implementation
}
```

### 3.2 checkpointSave Method

```typescript
public async checkpointSave() {
    // Copy your implementation from roo_cursor
    const service = this.getCheckpointService()
    // ...rest of implementation
}
```

### 3.3 Add New Methods

```typescript
// Add any new methods from your branch
public async getVerifiedCheckpoint(): Promise<string | undefined> {
    const service = this.getCheckpointService()
    if (service) {
        return await service.getVerifiedCheckpoint()
    }
    return undefined
}

// Add helper functions if needed
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
```

## Step 4: Update OS Context Handling

Find and update the parseMentions calls:

```typescript
// Find the code that calls parseMentions in initiateTaskLoop method
Promise.all(
    userContent.map(async (block) => {
        const { osInfo } = (await this.providerRef.deref()?.getState()) || { osInfo: "unix" }

        // Update each parseMentions call to include osInfo parameter
        text: await parseMentions(block.text, this.cwd, this.urlContentFetcher, osInfo),
        // ...
    })
)
```

## Step 5: Update Tool Files with Your Improvements

For each tool that had improvements in your branch, update the corresponding modular file:

### 5.1 attemptCompletionTool.ts

```bash
code src/core/tools/attemptCompletionTool.ts
```

Add the checkpoint diff viewing:

```typescript
// Add inside the tool function where appropriate
if (cline.parentTask) {
	// ...existing implementation
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

### 5.2 Repeat for Other Tool Files

Check and update each tool file with your specific improvements from roo_cursor.

## Step 6: Test Your Changes

1. Run the TypeScript compiler to check for errors:

    ```bash
    npm run build -- --noEmit
    ```

2. Fix any errors that appear

3. Manually test the functionality:
    - Test checkpoint operations
    - Verify diff viewing works correctly
    - Test each tool that was updated

## Step 7: Commit Your Changes

```bash
git add .
git commit -m "Integrate roo_cursor improvements into modular structure"
```

## Troubleshooting

If you encounter issues:

1. Check the original implementations in your roo_cursor branch
2. Ensure all imported dependencies are available
3. Verify function signatures match between calls and implementations
4. Look for any missed OS-specific handling
