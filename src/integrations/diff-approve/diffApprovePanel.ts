import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"
import { getNonce } from "./util"
import { DiffContent, DiffBlock, ApprovalAction } from "./types"

export class DiffApprovePanel {
	public static currentPanel: DiffApprovePanel | undefined
	private readonly _panel: vscode.WebviewPanel
	private readonly _extensionUri: vscode.Uri
	private _disposables: vscode.Disposable[] = []
	private _file1Uri: vscode.Uri
	private _file2Uri: vscode.Uri
	private _diffContent: DiffContent | undefined
	private _pendingBlocks: Set<number> = new Set()

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		file1Uri: vscode.Uri,
		file2Uri: vscode.Uri,
	) {
		this._panel = panel
		this._extensionUri = extensionUri
		this._file1Uri = file1Uri
		this._file2Uri = file2Uri

		// Set the webview's initial html content
		this._update()

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			async (message: { command: string; blockId?: number; action?: ApprovalAction }) => {
				switch (message.command) {
					case "approve":
						if (message.blockId !== undefined && message.action) {
							await this._handleApproval(message.blockId, message.action)
						}
						return
					case "approveAll":
						await this._handleApproveAll()
						return
					case "denyAll":
						await this._handleDenyAll()
						return
					case "getContent":
						await this._loadDiffContent()
						if (this._diffContent) {
							// Initialize the pending blocks with all non-context blocks
							this._pendingBlocks = new Set(
								this._diffContent.blocks
									.filter((block) => block.type !== "context")
									.map((block) => block.id),
							)
						}
						this._panel.webview.postMessage({
							command: "contentLoaded",
							content: this._diffContent,
							pendingBlocks: Array.from(this._pendingBlocks),
						})
						return
					case "openFile":
						this._openModifiedFile()
						return
				}
			},
			null,
			this._disposables,
		)
	}

	public static createOrShow(extensionUri: vscode.Uri, file1Uri: vscode.Uri, file2Uri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

		// If we already have a panel, show it.
		if (DiffApprovePanel.currentPanel) {
			DiffApprovePanel.currentPanel._panel.reveal(column)
			DiffApprovePanel.currentPanel._file1Uri = file1Uri
			DiffApprovePanel.currentPanel._file2Uri = file2Uri
			DiffApprovePanel.currentPanel._update()
			return
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel("diffApprove", "Diff Approve", column || vscode.ViewColumn.One, {
			// Enable scripts in the webview
			enableScripts: true,
			localResourceRoots: [extensionUri],
		})

		DiffApprovePanel.currentPanel = new DiffApprovePanel(panel, extensionUri, file1Uri, file2Uri)
	}

	public dispose(): void {
		DiffApprovePanel.currentPanel = undefined

		// Clean up our resources
		this._panel.dispose()

		while (this._disposables.length) {
			const x = this._disposables.pop()
			if (x) {
				x.dispose()
			}
		}
	}

	private async _loadDiffContent(): Promise<void> {
		try {
			// Read file contents
			const file1Content = fs.readFileSync(this._file1Uri.fsPath, "utf8")
			const file2Content = fs.readFileSync(this._file2Uri.fsPath, "utf8")

			// Calculate diff using our diff algorithm
			const diffs = await this._computeDiff(file1Content, file2Content)

			this._diffContent = {
				file1: path.basename(this._file1Uri.fsPath),
				file2: path.basename(this._file2Uri.fsPath),
				blocks: diffs,
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				`Error loading diff content: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}

	private async _openModifiedFile(): Promise<void> {
		try {
			const doc = await vscode.workspace.openTextDocument(this._file2Uri)
			// Open in the same view column as the diff view
			await vscode.window.showTextDocument(doc, this._panel.viewColumn)
			// Close the diff view panel after opening the file
			this.dispose()
		} catch (err) {
			vscode.window.showErrorMessage(`Error opening file: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	private async _computeDiff(content1: string, content2: string): Promise<DiffBlock[]> {
		// This is a placeholder for a more sophisticated diff algorithm
		// In a real extension, you would use a proper diff library

		const lines1 = content1.split("\n")
		const lines2 = content2.split("\n")
		const blocks: DiffBlock[] = []
		let blockId = 0

		// Simple line-by-line comparison (not efficient for real use)
		let i = 0,
			j = 0

		while (i < lines1.length || j < lines2.length) {
			if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
				// Lines match, add as context
				if (blocks.length === 0 || blocks[blocks.length - 1].type !== "context") {
					blocks.push({
						id: blockId++,
						type: "context",
						oldStart: i + 1,
						oldLines: [],
						newStart: j + 1,
						newLines: [],
					})
				}

				blocks[blocks.length - 1].oldLines.push(lines1[i])
				blocks[blocks.length - 1].newLines.push(lines2[j])

				i++
				j++
			} else {
				// Lines differ, find the next match point
				let nextMatchOld = -1
				let nextMatchNew = -1

				for (let searchI = i; searchI < Math.min(i + 10, lines1.length); searchI++) {
					for (let searchJ = j; searchJ < Math.min(j + 10, lines2.length); searchJ++) {
						if (lines1[searchI] === lines2[searchJ]) {
							nextMatchOld = searchI
							nextMatchNew = searchJ
							break
						}
					}
					if (nextMatchOld !== -1) break
				}

				if (nextMatchOld === -1) {
					// No match found within the search window
					if (i < lines1.length && j < lines2.length) {
						// Both files have remaining lines, treat as a change
						blocks.push({
							id: blockId++,
							type: "change",
							oldStart: i + 1,
							oldLines: [lines1[i]],
							newStart: j + 1,
							newLines: [lines2[j]],
						})
						i++
						j++
					} else if (i < lines1.length) {
						// Only old file has remaining lines, treat as deletion
						blocks.push({
							id: blockId++,
							type: "deletion",
							oldStart: i + 1,
							oldLines: [lines1[i]],
							newStart: j + 1,
							newLines: [],
						})
						i++
					} else {
						// Only new file has remaining lines, treat as addition
						blocks.push({
							id: blockId++,
							type: "addition",
							oldStart: i + 1,
							oldLines: [],
							newStart: j + 1,
							newLines: [lines2[j]],
						})
						j++
					}
				} else {
					// Found a match point
					if (nextMatchOld > i && nextMatchNew > j) {
						// Both files have changed lines
						blocks.push({
							id: blockId++,
							type: "change",
							oldStart: i + 1,
							oldLines: lines1.slice(i, nextMatchOld),
							newStart: j + 1,
							newLines: lines2.slice(j, nextMatchNew),
						})
					} else if (nextMatchOld > i) {
						// Only old file has changed lines, treat as deletion
						blocks.push({
							id: blockId++,
							type: "deletion",
							oldStart: i + 1,
							oldLines: lines1.slice(i, nextMatchOld),
							newStart: j + 1,
							newLines: [],
						})
					} else {
						// Only new file has changed lines, treat as addition
						blocks.push({
							id: blockId++,
							type: "addition",
							oldStart: i + 1,
							oldLines: [],
							newStart: j + 1,
							newLines: lines2.slice(j, nextMatchNew),
						})
					}

					i = nextMatchOld
					j = nextMatchNew
				}
			}
		}

		return blocks
	}

	private async _handleApproveAll(): Promise<void> {
		if (!this._diffContent) return

		// Mark all blocks as approved by removing them from pending blocks
		this._pendingBlocks.clear()

		// Send updated pending blocks to the webview
		this._panel.webview.postMessage({
			command: "updatePendingBlocks",
			pendingBlocks: Array.from(this._pendingBlocks),
		})

		vscode.window.showInformationMessage("All changes approved")

		// Auto-open file when all changes are handled
		this._checkIfAllBlocksProcessed()
	}

	private async _handleDenyAll(): Promise<void> {
		if (!this._diffContent) return

		// Apply deny action to all non-context blocks
		const nonContextBlocks = this._diffContent.blocks.filter((block) => block.type !== "context")

		for (const block of nonContextBlocks) {
			await this._handleApproval(block.id, "deny", false)
		}

		// Update the diff content and clear pending blocks
		await this._loadDiffContent()
		this._pendingBlocks.clear()

		// Send updated content and pending blocks to the webview
		this._panel.webview.postMessage({
			command: "contentLoaded",
			content: this._diffContent,
			pendingBlocks: Array.from(this._pendingBlocks),
		})

		vscode.window.showInformationMessage("All changes denied and reverted")

		// Auto-open file when all changes are handled
		this._checkIfAllBlocksProcessed()
	}

	private async _handleApproval(blockId: number, action: ApprovalAction, updateUI: boolean = true): Promise<void> {
		if (!this._diffContent) return

		const block = this._diffContent.blocks.find((b) => b.id === blockId)
		if (!block) return

		try {
			if (action === "approve") {
				// For approve, we keep the change and remove the block from pending
				this._pendingBlocks.delete(blockId)
				vscode.window.showInformationMessage(`Approved change for block ${blockId}`)
			} else if (action === "deny") {
				// For deny, we revert the change by applying the left side content to the right file
				const file2Content = fs.readFileSync(this._file2Uri.fsPath, "utf8")
				const lines = file2Content.split("\n")

				// Apply the revert
				switch (block.type) {
					case "addition":
						// Remove added lines
						lines.splice(block.newStart - 1, block.newLines.length)
						break
					case "deletion":
						// Restore deleted lines
						lines.splice(block.newStart - 1, 0, ...block.oldLines)
						break
					case "change":
						// Replace changed lines with original
						lines.splice(block.newStart - 1, block.newLines.length, ...block.oldLines)
						break
				}

				// Write back the file
				fs.writeFileSync(this._file2Uri.fsPath, lines.join("\n"), "utf8")
				this._pendingBlocks.delete(blockId)
				vscode.window.showInformationMessage(`Denied change for block ${blockId}, reverted to original`)

				if (updateUI) {
					// Reload the diff after the change
					await this._loadDiffContent()
					this._panel.webview.postMessage({
						command: "contentLoaded",
						content: this._diffContent,
						pendingBlocks: Array.from(this._pendingBlocks),
					})
				}
			}

			// Check if all blocks have been processed
			this._checkIfAllBlocksProcessed()
		} catch (err) {
			vscode.window.showErrorMessage(
				`Error handling approval: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}

	private _checkIfAllBlocksProcessed(): void {
		if (this._pendingBlocks.size === 0) {
			// All blocks have been processed, automatically open the file
			this._openModifiedFile()
		}
	}

	private _update(): void {
		const webview = this._panel.webview
		this._panel.title = `Diff: ${path.basename(this._file1Uri.fsPath)} ↔ ${path.basename(this._file2Uri.fsPath)}`
		this._panel.webview.html = this._getHtmlForWebview(webview)
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to css for the webview
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"))

		// Use a nonce to whitelist scripts in the webview
		const nonce = getNonce()

		return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
      <link href="${styleMainUri}" rel="stylesheet">
      <title>Diff Approve</title>
    </head>
    <body>
      <div class="header">
        <div class="file-info">
          <div class="file old-file">Original: <span id="file1-name"></span></div>
          <div class="file new-file">Modified: <span id="file2-name"></span></div>
        </div>
      </div>
      
      <div class="diff-container" id="diff-container">
        <div class="loading">Loading diff...</div>
      </div>
      
      <div class="global-actions">
        <button id="approve-all-btn" class="approve-button">Approve All</button>
        <button id="deny-all-btn" class="deny-button">Deny All</button>
        <button id="open-file-btn" class="open-file-button">Open Modified File</button>
      </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // Initial state
        let diffContent = null;
        let pendingBlocks = new Set();
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'contentLoaded':
              diffContent = message.content;
              if (message.pendingBlocks) {
                pendingBlocks = new Set(message.pendingBlocks);
              }
              renderDiff(diffContent, pendingBlocks);
              break;
            case 'updatePendingBlocks':
              pendingBlocks = new Set(message.pendingBlocks);
              renderDiff(diffContent, pendingBlocks);
              break;
          }
        });
        
        // Request content when page loads
        window.addEventListener('load', () => {
          vscode.postMessage({ command: 'getContent' });
          
          // Add event listeners for the global action buttons
          document.getElementById('approve-all-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'approveAll' });
          });
          
          document.getElementById('deny-all-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'denyAll' });
          });
          
          document.getElementById('open-file-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile' });
          });
        });
        
        // Functions to handle approval and rejection
        function approveBlock(blockId) {
          vscode.postMessage({
            command: 'approve',
            blockId: blockId,
            action: 'approve'
          });
          
          // Update UI immediately to hide the approved block
          pendingBlocks.delete(blockId);
          renderDiff(diffContent, pendingBlocks);
        }
        
        function denyBlock(blockId) {
          vscode.postMessage({
            command: 'approve',
            blockId: blockId,
            action: 'deny'
          });
          // UI will be updated when content is reloaded
        }
        
        function renderDiff(content, pendingBlocks) {
          if (!content) return;
          
          // Update file names
          document.getElementById('file1-name').textContent = content.file1;
          document.getElementById('file2-name').textContent = content.file2;
          
          const container = document.getElementById('diff-container');
          container.innerHTML = '';
          
          // Show all context blocks and only pending non-context blocks
          const visibleBlocks = content.blocks.filter(block => 
            block.type === 'context' || pendingBlocks.has(block.id)
          );
          
          if (visibleBlocks.length === 0) {
            container.innerHTML = '<div class="no-changes">No pending changes to review.</div>';
            return;
          }
          
          // Remove empty context blocks that may appear between approved changes
          const filteredBlocks = [];
          for (let i = 0; i < visibleBlocks.length; i++) {
            const block = visibleBlocks[i];
            
            // If it's a context block, check if it's needed
            if (block.type === 'context') {
              // Keep the first and last context blocks
              if (i === 0 || i === visibleBlocks.length - 1) {
                filteredBlocks.push(block);
                continue;
              }
              
              // Keep context blocks that are between two different types of blocks
              const prevBlock = visibleBlocks[i - 1];
              const nextBlock = visibleBlocks[i + 1];
              
              if (prevBlock && nextBlock && 
                  (prevBlock.type !== 'context' || nextBlock.type !== 'context')) {
                filteredBlocks.push(block);
              }
            } else {
              // Always include non-context blocks
              filteredBlocks.push(block);
            }
          }
          
          // Render each visible diff block
          filteredBlocks.forEach(block => {
            const blockElement = document.createElement('div');
            blockElement.className = \`diff-block diff-\${block.type}\`;
            blockElement.dataset.id = block.id;
            
            let blockHtml = '';
            
            // Block header with line numbers
            blockHtml += \`<div class="diff-header">
              <span class="line-numbers">@@ -\${block.oldStart},\${block.oldLines.length} +\${block.newStart},\${block.newLines.length} @@</span>
            </div>\`;
            
            // Content rows
            blockHtml += '<div class="diff-content">';
            
            // Render based on block type
            switch(block.type) {
              case 'context':
                // Context lines (unchanged)
                for (let i = 0; i < block.oldLines.length; i++) {
                  blockHtml += \`<div class="diff-line context-line"><div class="line-number old">\${block.oldStart + i}</div><div class="line-number new">\${block.newStart + i}</div><div class="line-content">\${escapeHtml(block.oldLines[i])}</div></div>\`;
                }
                break;
              
              case 'addition':
                // Added lines
                for (let i = 0; i < block.newLines.length; i++) {
                  blockHtml += \`<div class="diff-line addition-line"><div class="line-number old"></div><div class="line-number new">\${block.newStart + i}</div><div class="line-content">\${escapeHtml(block.newLines[i])}</div></div>\`;
                }
                
                // Add approval buttons for non-context blocks
                blockHtml += \`<div class="approval-buttons">
                  <button class="approve-button" data-id="\${block.id}">Accept</button>
                  <button class="deny-button" data-id="\${block.id}">Reject</button>
                </div>\`;
                break;
              
              case 'deletion':
                // Deleted lines
                for (let i = 0; i < block.oldLines.length; i++) {
                  blockHtml += \`<div class="diff-line deletion-line"><div class="line-number old">\${block.oldStart + i}</div><div class="line-number new"></div><div class="line-content">\${escapeHtml(block.oldLines[i])}</div></div>\`;
                }
                
                // Add approval buttons for non-context blocks
                blockHtml += \`<div class="approval-buttons">
                  <button class="approve-button" data-id="\${block.id}">Accept</button>
                  <button class="deny-button" data-id="\${block.id}">Reject</button>
                </div>\`;
                break;
              
              case 'change':
                // Changed lines - show both old and new
                const maxLines = Math.max(block.oldLines.length, block.newLines.length);
                
                for (let i = 0; i < maxLines; i++) {
                  if (i < block.oldLines.length) {
                    blockHtml += \`<div class="diff-line deletion-line"><div class="line-number old">\${block.oldStart + i}</div><div class="line-number new"></div><div class="line-content">\${escapeHtml(block.oldLines[i])}</div></div>\`;
                  }
                  
                  if (i < block.newLines.length) {
                    blockHtml += \`<div class="diff-line addition-line"><div class="line-number old"></div><div class="line-number new">\${block.newStart + i}</div><div class="line-content">\${escapeHtml(block.newLines[i])}</div></div>\`;
                  }
                }
                
                // Add approval buttons for non-context blocks
                blockHtml += \`<div class="approval-buttons">
                  <button class="approve-button" data-id="\${block.id}">Accept</button>
                  <button class="deny-button" data-id="\${block.id}">Reject</button>
                </div>\`;
                break;
            }
            
            blockHtml += '</div>';
            
            blockElement.innerHTML = blockHtml;
            container.appendChild(blockElement);
          });
          
          // Add event listeners to all buttons after they are added to the DOM
          document.querySelectorAll('.approve-button:not(#approve-all-btn)').forEach(button => {
            button.addEventListener('click', function() {
              const blockId = parseInt(this.getAttribute('data-id'), 10);
              approveBlock(blockId);
            });
          });
          
          document.querySelectorAll('.deny-button:not(#deny-all-btn)').forEach(button => {
            button.addEventListener('click', function() {
              const blockId = parseInt(this.getAttribute('data-id'), 10);
              denyBlock(blockId);
            });
          });
        }
        
        function escapeHtml(unsafe) {
          return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }
      </script>
    </body>
    </html>`
	}
}
