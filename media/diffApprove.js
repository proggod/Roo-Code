// @ts-check

const vscode = acquireVsCodeApi()

document.getElementById("approveAll").onclick = function () {
	vscode.postMessage({ type: "approveAll" })
}

document.getElementById("denyAll").onclick = function () {
	vscode.postMessage({ type: "denyAll" })
}

document.querySelectorAll("button[data-block-id]").forEach(function (button) {
	button.onclick = function () {
		const blockId = parseInt(this.getAttribute("data-block-id") || "0")
		const action = this.getAttribute("data-action") || ""
		vscode.postMessage({ type: action, blockId: blockId })
	}
})
