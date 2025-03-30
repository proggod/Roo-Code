import React, { useEffect } from "react"
import DynamicTextArea from "react-textarea-autosize"
import { vscode } from "../../utils/vscode"

interface SystemPromptTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	placeholderText: string
}

const SystemPromptTextArea = ({ inputValue, setInputValue, placeholderText }: SystemPromptTextAreaProps) => {
	// Add effect to sync with extension
	useEffect(() => {
		console.log("[SystemPromptTextArea] Value changed:", inputValue)
		vscode.postMessage({
			type: "updateSystemPromptAppendText",
			text: inputValue,
		})
	}, [inputValue])

	return (
		<div className="border-t border-vscode-editor-background p-3">
			<DynamicTextArea
				value={inputValue}
				onChange={({ target: { value } }) => setInputValue(value)}
				placeholder={placeholderText}
				minRows={1}
				maxRows={3}
				className="w-full resize-none bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-3 py-2"
			/>
		</div>
	)
}

export default SystemPromptTextArea
