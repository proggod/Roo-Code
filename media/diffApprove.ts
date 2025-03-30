declare function acquireVsCodeApi(): {
	postMessage(message: any): void
	getState(): any
	setState(state: any): void
}

;(function () {
	try {
		// Get VSCode API
		const vscode = acquireVsCodeApi()

		// Log function that uses postMessage
		function log(message: string) {
			vscode.postMessage({ type: "log", message: `[Webview] ${message}` })
		}

		log("Script loaded")

		function initializeDiffApprove(): void {
			log("Initializing diff approve view")

			// Attach event listeners
			const approveAllBtn = document.getElementById("approveAll")
			const denyAllBtn = document.getElementById("denyAll")

			if (approveAllBtn) {
				log("Found approveAll button")
				approveAllBtn.onclick = function () {
					log("Approve all button clicked")
					this.textContent = "✓ CLICKED - APPROVE ALL!"
					this.style.backgroundColor = "purple"
					vscode.postMessage({ command: "approveAll" })
				}
			} else {
				log("Could not find approveAll button")
			}

			if (denyAllBtn) {
				log("Found denyAll button")
				denyAllBtn.onclick = function () {
					log("Deny all button clicked")
					this.textContent = "✗ CLICKED - DENY ALL!"
					this.style.backgroundColor = "purple"
					vscode.postMessage({ command: "denyAll" })
				}
			} else {
				log("Could not find denyAll button")
			}

			// Individual block buttons
			const blockButtons = document.querySelectorAll<HTMLButtonElement>("button[data-block-id]")
			log(`Found ${blockButtons.length} block buttons`)

			blockButtons.forEach((button) => {
				button.onclick = function () {
					const blockId = this.getAttribute("data-block-id")
					const action = this.getAttribute("data-action")
					if (blockId && action) {
						log(`Block button clicked: ${action} ${blockId}`)
						this.textContent = `CLICKED - ${action.toUpperCase()} #${blockId}!`
						this.style.backgroundColor = "purple"
						vscode.postMessage({ command: action, blockId: parseInt(blockId, 10) })
					}
				}
			})

			log("Event listeners attached")
		}

		// Initialize when the script loads
		if (document.readyState === "loading") {
			log("Document loading, waiting for DOMContentLoaded")
			document.addEventListener("DOMContentLoaded", () => {
				log("DOMContentLoaded fired")
				initializeDiffApprove()
			})
		} else {
			log("Document already loaded")
			initializeDiffApprove()
		}
	} catch (error) {
		// Since we can't use console.log, send the error through postMessage
		try {
			acquireVsCodeApi().postMessage({
				type: "log",
				message: `[Webview Error] ${error instanceof Error ? error.message : String(error)}`,
			})
		} catch {
			// If everything fails, we can't do much
		}
	}
})()
