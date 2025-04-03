# Tool Update Checklist

Use this checklist to track the migration of improvements from roo_cursor's inline implementations to the modular tool files in main.

## Core Tools

### writeToFileTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for error handling improvements
- [ ] Verify file path handling
- [ ] Update any UI/UX enhancements
- [ ] Test functionality after changes

### applyDiffTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for improvements in diff application logic
- [ ] Update error handling for failed diff parts
- [ ] Verify partFailHint implementation
- [ ] Test functionality after changes

### insertContentTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for error handling improvements
- [ ] Verify operation parsing logic
- [ ] Update any UI feedback mechanisms
- [ ] Test functionality after changes

### readFileTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for OS-specific path handling
- [ ] Update error handling
- [ ] Test functionality after changes

### fetchInstructionsTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for any improvements
- [ ] Test functionality after changes

## Content Management Tools

### listFilesTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for recursive file listing improvements
- [ ] Update RooIgnore integration
- [ ] Test functionality after changes

### listCodeDefinitionNamesTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for parsing improvements
- [ ] Test functionality after changes

### searchFilesTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for regex search enhancements
- [ ] Update file pattern handling
- [ ] Test functionality after changes

## Interaction Tools

### browserActionTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Update browser session management
- [ ] Check screenshot handling
- [ ] Verify browser cleanup logic
- [ ] Test functionality after changes

### executeCommandTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for command validation improvements
- [ ] Update output handling
- [ ] Test functionality after changes

### useMcpToolTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Update MCP tool integration
- [ ] Check for argument parsing improvements
- [ ] Verify error handling
- [ ] Test functionality after changes

### accessMcpResourceTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Update resource access logic
- [ ] Check for image handling improvements
- [ ] Test functionality after changes

### askFollowupQuestionTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for XML parsing improvements
- [ ] Update suggestion handling
- [ ] Test functionality after changes

### switchModeTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Check for mode slug validation
- [ ] Update transition handling
- [ ] Test functionality after changes

### newTaskTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Update task spawning logic
- [ ] Check for paused mode handling
- [ ] Test functionality after changes

### attemptCompletionTool.ts

- [ ] Compare with roo_cursor branch implementation
- [ ] Update completion result handling
- [ ] Add auto-open diff viewer functionality
- [ ] Check for parent task handling improvements
- [ ] Test functionality after changes

## Additional Components

### DiffApproveProvider

- [ ] Create src/integrations/diff-approve/ directory
- [ ] Implement DiffApproveProvider from roo_cursor
- [ ] Ensure proper integration with Cline class
- [ ] Test functionality after changes

## Final Verification Steps

- [ ] Ensure all tools use proper typing (no any types)
- [ ] Verify consistent error handling across tools
- [ ] Make sure all tools properly handle the `this` context
- [ ] Run build with --noEmit to check for TypeScript errors
- [ ] Test complete workflows with all updated tools
- [ ] Check for any remaining inline tool references in Cline.ts
