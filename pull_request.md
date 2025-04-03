## Context

This PR introduces three major improvements to Roo Code:

1. A new unified diff viewer that provides more accurate and reliable code changes
2. An API logger for better debugging and monitoring of model interactions
3. Enhanced system prompt handling for improved model responses

## Implementation

### New Unified Diff Viewer

- Implemented a new `NewUnifiedDiffStrategy` that provides more robust diff application
- Added intelligent context matching with configurable confidence thresholds
- Improved handling of indentation, line endings, and complex code changes
- Added support for splitting large hunks into smaller, more manageable pieces
- Implemented multiple search strategies (context matching, similarity matching) for better accuracy

### API Logger

- Added a new API logging system that captures system prompts and messages
- Logs are stored in `~/.roo_logs/api_history.txt`
- Each log entry includes:
    - Timestamp
    - System prompt
    - Message history
    - Request details
- Logging can be enabled/disabled via configuration

### System Prompt Enhancements

- Added support for dynamic system prompt appending
- Improved handling of system prompts across different model providers
- Added better formatting and cleaning of system prompts
- Enhanced support for model-specific prompt requirements

## Binary

You can find the pre-built binary in the [GitHub Release](https://github.com/proggod/Roo-Code/releases/latest).

## Screenshots

| before                                       | after                                                           |
| -------------------------------------------- | --------------------------------------------------------------- |
| [Previous diff viewer showing basic changes] | [New unified diff viewer showing improved context and accuracy] |
| [No API logging]                             | [API logging showing detailed request information]              |

## How to Test

1. Testing the Diff Viewer:

    - Make complex code changes with indentation modifications
    - Verify that the changes are applied correctly with proper context
    - Test with various file types and change patterns

2. Testing the API Logger:

    - Enable API logging in settings
    - Make a few requests to different models
    - Check `~/.roo_logs/api_history.txt` for detailed logs
    - Verify that system prompts and messages are captured correctly

3. Testing System Prompt Changes:
    - Try different system prompt configurations
    - Verify that prompts are properly formatted for each model
    - Check that dynamic prompt appending works as expected

## Get in Touch

I'm available in the Roo Code Discord as [your handle] for any questions or feedback about these changes.
