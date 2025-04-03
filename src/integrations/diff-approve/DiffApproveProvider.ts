// DiffApproveProvider.ts
import * as vscode from "vscode"
import * as path from "path"
import * as diff from "diff"
import { getNonce } from "./util"

export const DIFF_APPROVE_URI_SCHEME = "roo-diff-approve"

export interface DiffBlock {
	id: number
	type: "addition" | "deletion" | "change" | "context"
	oldLines: string[]
	newLines: string[]
	oldStart: number
	newStart: number
}

export interface DiffContent {
	file1: string
	file2: string
	blocks: DiffBlock[]
}

// Class to handle a single file's diff view
class DiffFile {
	private panel!: vscode.WebviewPanel
	private pendingBlocks: Set<number> = new Set()
	private hasCalledAllBlocksProcessed: boolean = false
	private disposables: vscode.Disposable[] = []
	private fileName: string

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly filePath: string,
		private readonly onBlockApprove: (blockId: number, approved: boolean) => Promise<void>,
		private readonly onAllBlocksProcessed: () => Promise<void>,
	) {
		this.fileName = path.basename(filePath)
	}

	public async show(oldVersionUri: vscode.Uri, workingUri: vscode.Uri): Promise<void> {
		const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One

		// Create a new panel with the file name in the title
		this.panel = vscode.window.createWebviewPanel("diffApprove", `Approve Changes: ${this.fileName}`, column, {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		})

		// Set initial content
		await this.updateContent(oldVersionUri, workingUri)

		// Handle messages from the webview
		this.panel.webview.onDidReceiveMessage(
			async (message: { type: string; blockId?: number }) => {
				console.log(`[DiffFile] 🔵 BUTTON CLICKED in ${this.fileName}: ${message.type}`, {
					blockId: message.blockId,
					pendingBlocksSize: this.pendingBlocks.size,
					filePath: this.filePath,
				})

				switch (message.type) {
					case "approve":
					case "deny": {
						if (message.blockId !== undefined) {
							// Find the group containing this block
							const blocks = this.findRelatedBlocks(message.blockId)
							if (blocks.length > 0) {
								console.log(
									`[DiffFile] Processing ${blocks.length} blocks in group for ${message.type}`,
									{
										blockIds: blocks.map((b) => b.id),
										pendingBlocksSizeBefore: this.pendingBlocks.size,
									},
								)
								// Process all blocks in the group
								for (const block of blocks) {
									await this.onBlockApprove(block.id, message.type === "approve")
									this.pendingBlocks.delete(block.id)
								}

								// Send message back to webview to update UI
								this.panel.webview.postMessage({
									type: message.type === "approve" ? "blockApproved" : "blockDenied",
									blockId: message.blockId,
								})

								if (this.pendingBlocks.size === 0) {
									console.log(
										`[DiffFile] All blocks processed for ${this.fileName}, calling onAllBlocksProcessed`,
									)
									try {
										if (!this.hasCalledAllBlocksProcessed) {
											this.hasCalledAllBlocksProcessed = true
											// Mark this file as approved only when all blocks are explicitly approved
											DiffApproveProvider.markFileAsApproved(this.filePath)
											await this.onAllBlocksProcessed()
											console.log(
												`[DiffFile] onAllBlocksProcessed completed successfully for ${this.fileName}`,
											)

											// Close the panel automatically after a short delay
											setTimeout(() => {
												console.log(
													`[DiffFile] Auto-closing panel for ${this.fileName} after all changes approved`,
												)
												this.dispose()
											}, 500)
										} else {
											console.log(
												`[DiffFile] onAllBlocksProcessed already called for ${this.fileName}, skipping`,
											)
										}
									} catch (error) {
										console.error(
											`[DiffFile] Error in onAllBlocksProcessed for ${this.fileName}:`,
											error,
										)
									}
								}
							}
						}
						break
					}
					case "approveAll":
					case "denyAll": {
						const isApprove = message.type === "approveAll"
						console.log(
							`[DiffFile] Processing ${this.pendingBlocks.size} pending blocks for ${isApprove ? "approve" : "deny"} all in ${this.fileName}`,
						)
						for (const blockId of this.pendingBlocks) {
							await this.onBlockApprove(blockId, isApprove)
						}
						// Send message back to webview to update UI
						this.panel.webview.postMessage({
							type: isApprove ? "allBlocksApproved" : "allBlocksDenied",
						})
						this.pendingBlocks.clear()
						console.log(
							`[DiffFile] All blocks processed in ${isApprove ? "approve" : "deny"} all for ${this.fileName}, calling onAllBlocksProcessed`,
						)
						try {
							if (!this.hasCalledAllBlocksProcessed) {
								this.hasCalledAllBlocksProcessed = true
								// Mark this file as approved only when all blocks are explicitly approved
								DiffApproveProvider.markFileAsApproved(this.filePath)
								await this.onAllBlocksProcessed()
								console.log(
									`[DiffFile] onAllBlocksProcessed completed successfully for ${isApprove ? "approve" : "deny"} all in ${this.fileName}`,
								)

								// Close the panel automatically after a short delay
								setTimeout(() => {
									console.log(
										`[DiffFile] Auto-closing panel for ${this.fileName} after all changes approved`,
									)
									this.dispose()
								}, 500)
							} else {
								console.log(
									`[DiffFile] onAllBlocksProcessed already called for ${isApprove ? "approve" : "deny"} all in ${this.fileName}, skipping`,
								)
							}
						} catch (error) {
							console.error(
								`[DiffFile] Error in onAllBlocksProcessed for ${isApprove ? "approve" : "deny"} all in ${this.fileName}:`,
								error,
							)
						}
						break
					}
				}
			},
			undefined,
			this.disposables,
		)

		// Clean up when panel is closed
		this.panel.onDidDispose(
			() => {
				console.log(`[DiffFile] 🔵 PANEL DISPOSED for ${this.fileName}`)

				console.log(
					`[DiffFile] Panel for ${this.fileName} disposed, ${this.pendingBlocks.size} pending blocks remaining`,
				)

				// If there are still pending blocks when the panel is closed,
				// we should NOT mark the file as approved
				if (this.pendingBlocks.size > 0) {
					console.log(
						`[DiffFile] Panel closed with pending blocks for ${this.fileName}, NOT marking as approved`,
					)
					// Do not call onAllBlocksProcessed here
					// The file will be shown again next time
				} else if (!this.hasCalledAllBlocksProcessed) {
					// All blocks were processed but onAllBlocksProcessed wasn't called yet
					console.log(
						`[DiffFile] Panel closed with all blocks processed for ${this.fileName}, marking as approved`,
					)
					try {
						this.hasCalledAllBlocksProcessed = true
						// Mark this file as approved
						DiffApproveProvider.markFileAsApproved(this.filePath)
						this.onAllBlocksProcessed().catch((error: Error) => {
							console.error(
								`[DiffFile] Error in onAllBlocksProcessed on panel close for ${this.fileName}:`,
								error,
							)
						})
						console.log(`[DiffFile] onAllBlocksProcessed called on panel close for ${this.fileName}`)
					} catch (error) {
						console.error(
							`[DiffFile] Error calling onAllBlocksProcessed on panel close for ${this.fileName}:`,
							error,
						)
					}
				}

				// Remove this file from the active files list
				DiffApproveProvider.removeActiveFile(this.filePath)

				// Clean up disposables
				this.disposeResources()
			},
			null,
			this.disposables,
		)
	}

	public dispose(): void {
		this.panel.dispose()
	}

	private async updateContent(oldVersionUri: vscode.Uri, workingUri: vscode.Uri): Promise<void> {
		try {
			const oldContent = await this.readFileContent(oldVersionUri)
			const newContent = await this.readFileContent(workingUri)

			// Compute diff blocks
			const blocks = this.computeDiff(oldContent, newContent)

			// Create diff content
			const diffContent: DiffContent = {
				file1: path.basename(oldVersionUri.fsPath),
				file2: this.fileName,
				blocks: blocks,
			}

			// Initialize pending blocks with all non-context blocks
			this.pendingBlocks = new Set(
				diffContent.blocks.filter((block) => block.type !== "context").map((block) => block.id),
			)

			// Update the webview HTML
			this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, diffContent, this.pendingBlocks)
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error loading diff content: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private findRelatedBlocks(blockId: number): DiffBlock[] {
		// This is a simplified implementation that just returns an array with the block itself
		return [
			{
				id: blockId,
				type: "change",
				oldLines: [],
				newLines: [],
				oldStart: 0,
				newStart: 0,
			},
		]
	}

	private async readFileContent(uri: vscode.Uri): Promise<string> {
		const content = await vscode.workspace.fs.readFile(uri)
		return content.toString()
	}

	private computeDiff(content1: string, content2: string): DiffBlock[] {
		const blocks: DiffBlock[] = []
		let blockId = 0
		let oldLineNumber = 1
		let newLineNumber = 1

		const changes = diff.diffLines(content1, content2)
		let pendingBlock: DiffBlock | null = null
		let lastChangeLineNumber = -1 // Track the last line number where we saw a change

		for (const part of changes) {
			const currentLineNumber = part.added ? newLineNumber : oldLineNumber

			if (part.added || part.removed) {
				const lines = part.value.split("\n").filter((line) => line.length > 0 || part.value.endsWith("\n"))

				// Start a new block if:
				// 1. We don't have a pending block, or
				// 2. There's a gap of more than 1 line from the last change, or
				// 3. The current change is not complementary to the pending block
				if (
					!pendingBlock ||
					currentLineNumber - lastChangeLineNumber > 1 ||
					(part.added && pendingBlock.type === "addition") ||
					(part.removed && pendingBlock.type === "deletion")
				) {
					if (pendingBlock) {
						blocks.push(pendingBlock)
					}

					pendingBlock = {
						id: blockId++,
						type: part.added ? "addition" : "deletion",
						oldLines: [],
						newLines: [],
						oldStart: oldLineNumber,
						newStart: newLineNumber,
					}
				} else if (
					(part.added && pendingBlock.type === "deletion") ||
					(part.removed && pendingBlock.type === "addition")
				) {
					// Convert to a change block only if the lines are adjacent
					pendingBlock.type = "change"
				}

				if (part.added) {
					pendingBlock.newLines.push(...lines)
					newLineNumber += part.count || 0
					lastChangeLineNumber = newLineNumber - 1
				} else {
					pendingBlock.oldLines.push(...lines)
					oldLineNumber += part.count || 0
					lastChangeLineNumber = oldLineNumber - 1
				}
			} else {
				// Push any pending block before context
				if (pendingBlock) {
					blocks.push(pendingBlock)
					pendingBlock = null
				}

				const contextLines = part.value
					.split("\n")
					.filter((line) => line.length > 0 || part.value.endsWith("\n"))
				if (contextLines.length > 0) {
					blocks.push({
						id: blockId++,
						type: "context",
						oldLines: contextLines,
						newLines: contextLines,
						oldStart: oldLineNumber,
						newStart: newLineNumber,
					})
				}
				oldLineNumber += part.count || 0
				newLineNumber += part.count || 0
				lastChangeLineNumber = -1 // Reset last change line number after context
			}
		}

		// Push any remaining block
		if (pendingBlock) {
			blocks.push(pendingBlock)
		}

		return blocks
	}

	private getHtmlForWebview(webview: vscode.Webview, diffContent: DiffContent, pendingBlocks: Set<number>): string {
		// Get the URI for the stylesheet
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "diffApprove.css"))

		const nonce = getNonce()

		return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Diff Approve</title>
        </head>
        <body>
            <div id="app">
                <div class="diff-header">
                    <h2>Reviewing changes: ${diffContent.file1} → ${diffContent.file2}</h2>
                    <div class="actions">
                        <button id="approveAll" type="button">✓ KEEP ALL CHANGES</button>
                        <button id="denyAll" type="button">✗ REVERT ALL CHANGES</button>
                    </div>
                </div>
                <div class="diff-content">
                    ${this.getDiffHtml(diffContent, pendingBlocks)}
                </div>
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                document.getElementById('approveAll').onclick = function() {
                    vscode.postMessage({ type: 'approveAll' });
                };

                document.getElementById('denyAll').onclick = function() {
                    vscode.postMessage({ type: 'denyAll' });
                };

                document.querySelectorAll('button[data-block-id]').forEach(function(button) {
                    button.onclick = function() {
                        const blockId = parseInt(this.getAttribute('data-block-id') || '0');
                        const action = this.getAttribute('data-action') || '';
                        vscode.postMessage({ type: action, blockId: blockId });
                    };
                });

                window.addEventListener('message', function(event) {
                    const message = event.data;
                    if (typeof message !== 'object' || !message || typeof message.type !== 'string') {
                        return;
                    }

                    switch (message.type) {
                        case 'blockApproved':
                        case 'blockDenied': {
                            const blockId = message.blockId;
                            if (typeof blockId === 'number') {
                                const selector = \`[data-block-id="\${blockId}"]\`;
                                const block = document.querySelector(selector)?.closest('.diff-block');
                                if (block instanceof HTMLElement) {
                                    block.classList.add(message.type === 'blockApproved' ? 'approved' : 'denied');
                                    block.querySelectorAll('button').forEach(btn => btn.remove());
                                }
                            }
                            break;
                        }
                        case 'allBlocksApproved':
                        case 'allBlocksDenied': {
                            document.querySelectorAll('.diff-block').forEach(block => {
                                if (block instanceof HTMLElement) {
                                    block.classList.add(message.type === 'allBlocksApproved' ? 'approved' : 'denied');
                                    block.querySelectorAll('button').forEach(btn => btn.remove());
                                }
                            });
                            break;
                        }
                    }
                });
            </script>
        </body>
        </html>`
	}

	private getDiffHtml(diffContent: DiffContent, pendingBlocks: Set<number>): string {
		if (!diffContent) {
			return '<div class="error">No diff content available</div>'
		}

		const processedBlocks = new Set<number>()
		return diffContent.blocks
			.map((block) => {
				// Skip if we've already processed this block as part of a group
				if (processedBlocks.has(block.id)) {
					return ""
				}

				const blockClass = `diff-block ${block.type}`
				const isPending = pendingBlocks.has(block.id)

				if (block.type === "context") {
					return `
                    <div class="${blockClass}">
                        ${block.oldLines
							.map(
								(line, i) => `
                                <div class="line">
                                    <span class="line-number">${block.oldStart + i}</span>
                                    <span class="content">${this.escapeHtml(line)}</span>
                                </div>`,
							)
							.join("")}
                    </div>`
				}

				// Single block handling
				const actions = isPending
					? `<div class="actions">
                       <button type="button" class="approve-button" data-action="approve" data-block-id="${block.id}">✓ Keep Change</button>
                       <button type="button" class="deny-button" data-action="deny" data-block-id="${block.id}">✗ Revert Change</button>
                   </div>`
					: ""

				return `
                <div class="${blockClass}" data-block-id="${block.id}">
                    <div class="block-header">
                        ${actions}
                    </div>
                    <div class="block-content">
                        ${this.getBlockContentHtml(block)}
                    </div>
                </div>`
			})
			.filter(Boolean)
			.join("\n")
	}

	private getBlockContentHtml(block: DiffBlock): string {
		switch (block.type) {
			case "deletion":
				return block.oldLines
					.map((line) => `<div class="line deletion">${this.escapeHtml(line)}</div>`)
					.join("\n")
			case "addition":
				return block.newLines
					.map((line) => `<div class="line addition">${this.escapeHtml(line)}</div>`)
					.join("\n")
			case "change":
				return `
                    <div class="old-content">
                        ${block.oldLines
							.map((line) => `<div class="line deletion">${this.escapeHtml(line)}</div>`)
							.join("\n")}
                    </div>
                    <div class="new-content">
                        ${block.newLines
							.map((line) => `<div class="line addition">${this.escapeHtml(line)}</div>`)
							.join("\n")}
                    </div>`
			default:
				return block.oldLines.map((line) => `<div class="line">${this.escapeHtml(line)}</div>`).join("\n")
		}
	}

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
	}

	private disposeResources(): void {
		// Clean up all disposables
		while (this.disposables.length) {
			try {
				const disposable = this.disposables.pop()
				disposable?.dispose()
			} catch (error) {
				console.error(`[DiffFile] Error disposing a disposable:`, error)
			}
		}
		console.log(`[DiffFile] All resources cleaned up`)
	}
}

export class DiffApproveProvider {
	// Keep track of active files
	private static activeFiles: Map<string, DiffFile> = new Map()

	// Keep track of which files have been fully approved
	private static approvedFiles: Set<string> = new Set()

	// Check if a file has been approved
	public static isFileApproved(filePath: string): boolean {
		return DiffApproveProvider.approvedFiles.has(filePath)
	}

	// Mark a file as approved
	public static markFileAsApproved(filePath: string): void {
		console.log(`[DiffApproveProvider] Marking file as approved: ${filePath}`)
		DiffApproveProvider.approvedFiles.add(filePath)
	}

	// Reset approved files tracking
	public static resetApprovedFiles(): void {
		console.log(`[DiffApproveProvider] Resetting approved files tracking`)
		DiffApproveProvider.approvedFiles.clear()
	}

	// Remove a file from the active files list
	public static removeActiveFile(filePath: string): void {
		console.log(`[DiffApproveProvider] Removing file from active files: ${filePath}`)
		DiffApproveProvider.activeFiles.delete(filePath)
		console.log(`[DiffApproveProvider] Active files remaining: ${DiffApproveProvider.activeFiles.size}`)
	}

	// Close all panels - useful for cleanup between diff attempts
	public static closeAllPanels(): void {
		console.log(`[DiffApproveProvider] Closing all panels (${DiffApproveProvider.activeFiles.size} panels open)`)
		for (const [filePath, diffFile] of DiffApproveProvider.activeFiles.entries()) {
			try {
				diffFile.dispose()
				console.log(`[DiffApproveProvider] Closed panel for ${filePath}`)
			} catch (error) {
				console.error(`[DiffApproveProvider] Error closing panel for ${filePath}:`, error)
			}
		}
		DiffApproveProvider.activeFiles.clear()
		console.log(`[DiffApproveProvider] All panels closed`)
	}

	private readonly extensionUri: vscode.Uri

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri
	}

	public async show(
		oldVersionUri: vscode.Uri,
		workingUri: vscode.Uri,
		onBlockApprove: (blockId: number, approved: boolean) => Promise<void>,
		onAllBlocksProcessed: () => Promise<void>,
	): Promise<void> {
		const filePath = workingUri.fsPath

		// Check if we already have an active file for this path
		let diffFile = DiffApproveProvider.activeFiles.get(filePath)

		// If we don't have an active file, create a new one
		if (!diffFile) {
			diffFile = new DiffFile(this.extensionUri, filePath, onBlockApprove, onAllBlocksProcessed)
			DiffApproveProvider.activeFiles.set(filePath, diffFile)
		}

		// Show the diff view
		await diffFile.show(oldVersionUri, workingUri)
	}

	public findRelatedBlocks(blockId: number, _state: any): DiffBlock[] {
		// This is a simplified implementation that just returns an array with the block itself
		return [
			{
				id: blockId,
				type: "change",
				oldLines: [],
				newLines: [],
				oldStart: 0,
				newStart: 0,
			},
		]
	}
}
