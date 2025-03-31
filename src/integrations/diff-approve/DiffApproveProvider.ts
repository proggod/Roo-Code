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

interface WebviewMessage {
	type: string
	blockId?: number
}

interface BlockMessage {
	type: "blockApproved" | "blockDenied" | "allBlocksApproved" | "allBlocksDenied"
	blockId?: number
}

export class DiffApproveProvider {
	private static currentPanel: vscode.WebviewPanel | undefined
	private readonly extensionUri: vscode.Uri
	private disposables: vscode.Disposable[] = []
	private diffContent?: DiffContent
	private pendingBlocks: Set<number> = new Set()
	private onBlockApprove?: (blockId: number, approved: boolean) => Promise<void>
	private onAllBlocksProcessed?: () => Promise<void>

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri
	}

	public async show(
		oldVersionUri: vscode.Uri,
		workingUri: vscode.Uri,
		onBlockApprove: (blockId: number, approved: boolean) => Promise<void>,
		onAllBlocksProcessed: () => Promise<void>,
	): Promise<void> {
		this.onBlockApprove = onBlockApprove
		this.onAllBlocksProcessed = onAllBlocksProcessed

		const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One

		// If we already have a panel, show it
		if (DiffApproveProvider.currentPanel) {
			DiffApproveProvider.currentPanel.reveal(column)
			await this.updateContent(oldVersionUri, workingUri)
			return
		}

		// Create a new panel
		const panel = vscode.window.createWebviewPanel("diffApprove", "Approve Changes", column, {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		})

		DiffApproveProvider.currentPanel = panel

		// Set initial content
		await this.updateContent(oldVersionUri, workingUri)

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			async (message: { type: string; blockId?: number }) => {
				if (!this.diffContent) return

				switch (message.type) {
					case "approve":
					case "deny": {
						if (message.blockId !== undefined) {
							// Find the group containing this block
							const blocks = this.findRelatedBlocks(message.blockId)
							if (blocks.length > 0) {
								// Process all blocks in the group
								for (const block of blocks) {
									await this.onBlockApprove?.(block.id, message.type === "approve")
									this.pendingBlocks.delete(block.id)
								}

								// Send message back to webview to update UI
								panel.webview.postMessage({
									type: message.type === "approve" ? "blockApproved" : "blockDenied",
									blockId: message.blockId,
								})

								if (this.pendingBlocks.size === 0) {
									await this.onAllBlocksProcessed?.()
									this.dispose()
								}
							}
						}
						break
					}
					case "approveAll":
					case "denyAll": {
						const isApprove = message.type === "approveAll"
						for (const blockId of this.pendingBlocks) {
							await this.onBlockApprove?.(blockId, isApprove)
						}
						// Send message back to webview to update UI
						panel.webview.postMessage({
							type: isApprove ? "allBlocksApproved" : "allBlocksDenied",
						})
						this.pendingBlocks.clear()
						await this.onAllBlocksProcessed?.()
						this.dispose()
						break
					}
				}
			},
			undefined,
			this.disposables,
		)

		// Clean up when panel is closed
		panel.onDidDispose(
			() => {
				this.dispose()
			},
			null,
			this.disposables,
		)
	}

	public findRelatedBlocks(blockId: number): DiffBlock[] {
		if (!this.diffContent) return []

		const blocks: DiffBlock[] = []
		const targetBlock = this.diffContent.blocks.find((block) => block.id === blockId)
		if (!targetBlock) return []

		// Find the index of our target block
		const targetIndex = this.diffContent.blocks.indexOf(targetBlock)

		// Look backwards for related blocks until we hit a context block
		for (let i = targetIndex; i >= 0; i--) {
			const block = this.diffContent.blocks[i]
			if (block.type === "context") break
			blocks.unshift(block) // Add to front to maintain order
		}

		// Look forwards for related blocks until we hit a context block
		for (let i = targetIndex + 1; i < this.diffContent.blocks.length; i++) {
			const block = this.diffContent.blocks[i]
			if (block.type === "context") break
			blocks.push(block)
		}

		return blocks
	}

	public getDiffBlock(blockId: number): DiffBlock | undefined {
		return this.diffContent?.blocks.find((block) => block.id === blockId)
	}

	private async updateContent(oldVersionUri: vscode.Uri, workingUri: vscode.Uri): Promise<void> {
		if (!DiffApproveProvider.currentPanel) {
			return
		}

		try {
			const oldContent = await this.readFileContent(oldVersionUri)
			const newContent = await this.readFileContent(workingUri)

			this.diffContent = {
				file1: path.basename(oldVersionUri.fsPath),
				file2: path.basename(workingUri.fsPath),
				blocks: this.computeDiff(oldContent, newContent),
			}

			// Initialize pending blocks with all non-context blocks
			this.pendingBlocks = new Set(
				this.diffContent.blocks.filter((block) => block.type !== "context").map((block) => block.id),
			)

			DiffApproveProvider.currentPanel.webview.html = this.getHtmlForWebview(
				DiffApproveProvider.currentPanel.webview,
			)
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error loading diff content: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async readFileContent(uri: vscode.Uri): Promise<string> {
		const content = await vscode.workspace.fs.readFile(uri)
		return content.toString()
	}

	private computeDiff(content1: string, content2: string): DiffBlock[] {
		const lines1 = content1.split("\n")
		const lines2 = content2.split("\n")
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

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "diffApprove.js"))

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
                    <h2>Reviewing changes: ${this.diffContent?.file1} → ${this.diffContent?.file2}</h2>
                    <div class="actions">
                        <button id="approveAll" type="button">✓ KEEP ALL CHANGES</button>
                        <button id="denyAll" type="button">✗ REVERT ALL CHANGES</button>
                    </div>
                </div>
                <div class="diff-content">
                    ${this.getDiffHtml()}
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

	private getDiffHtml(): string {
		if (!this.diffContent) {
			return '<div class="error">No diff content available</div>'
		}

		const processedBlocks = new Set<number>()
		return this.diffContent.blocks
			.map((block, index) => {
				// Skip if we've already processed this block as part of a group
				if (processedBlocks.has(block.id)) {
					return ""
				}

				const blockClass = `diff-block ${block.type}`
				const isPending = this.pendingBlocks.has(block.id)

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

				// Find related blocks
				const relatedBlocks = this.findRelatedBlocks(block.id)
				// Mark all related blocks as processed
				relatedBlocks.forEach((b) => processedBlocks.add(b.id))

				// If we have related blocks, treat them as a single change
				if (relatedBlocks.length > 1) {
					const oldLines: string[] = []
					const newLines: string[] = []

					relatedBlocks.forEach((b) => {
						if (b.type === "deletion" || b.type === "change") {
							oldLines.push(...b.oldLines)
						}
						if (b.type === "addition" || b.type === "change") {
							newLines.push(...b.newLines)
						}
					})

					const actions = isPending
						? `<div class="actions">
                           <button type="button" class="approve-button" data-action="approve" data-block-id="${block.id}">✓ Keep Change #${index + 1}</button>
                           <button type="button" class="deny-button" data-action="deny" data-block-id="${block.id}">✗ Revert Change #${index + 1}</button>
                       </div>`
						: ""

					return `
                    <div class="diff-block change" data-block-id="${block.id}">
                        <div class="block-header">
                            <span>Change ${index + 1}</span>
                            ${actions}
                        </div>
                        <div class="block-content">
                            <div class="old-content">
                                ${oldLines
									.map((line) => `<div class="line deletion">${this.escapeHtml(line)}</div>`)
									.join("\n")}
                            </div>
                            <div class="new-content">
                                ${newLines
									.map((line) => `<div class="line addition">${this.escapeHtml(line)}</div>`)
									.join("\n")}
                            </div>
                        </div>
                    </div>`
				}

				// Single block handling (no related blocks)
				const actions = isPending
					? `<div class="actions">
                       <button type="button" class="approve-button" data-action="approve" data-block-id="${block.id}">✓ Keep Change #${index + 1}</button>
                       <button type="button" class="deny-button" data-action="deny" data-block-id="${block.id}">✗ Revert Change #${index + 1}</button>
                   </div>`
					: ""

				return `
                <div class="${blockClass}" data-block-id="${block.id}">
                    <div class="block-header">
                        <span>Change ${index + 1}</span>
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

	public dispose(): void {
		DiffApproveProvider.currentPanel?.dispose()
		DiffApproveProvider.currentPanel = undefined

		while (this.disposables.length) {
			const disposable = this.disposables.pop()
			disposable?.dispose()
		}
	}
}
