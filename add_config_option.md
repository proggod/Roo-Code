# Adding a New Config Option to the Experiments System in Roo-Code

This guide outlines the process for adding a new config option to the experiments system in Roo-Code.

## Steps

1. Add the experiment ID to `src/shared/experiments.ts`
2. Add the schema definition in `src/schemas/index.ts`
3. Add default configuration in `src/shared/experiments.ts`
4. Add translations in language files under `webview-ui/src/i18n/locales/`
5. Use the experiment in the code

## Example: Adding the API Logging Experiment

### 1. Add Experiment ID

In `src/shared/experiments.ts`:

```typescript
export const EXPERIMENT_IDS = {
	DIFF_STRATEGY_UNIFIED: "experimentalDiffStrategy",
	INSERT_BLOCK: "insert_content",
	SEARCH_AND_REPLACE: "search_and_replace",
	POWER_STEERING: "powerSteering",
	API_LOGGING: "apiLogging", // Added new experiment
} as const satisfies Record<string, ExperimentId>

export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
	DIFF_STRATEGY_UNIFIED: { enabled: false },
	INSERT_BLOCK: { enabled: false },
	SEARCH_AND_REPLACE: { enabled: false },
	POWER_STEERING: { enabled: false },
	API_LOGGING: { enabled: false }, // Added default configuration
}
```

### 2. Add Schema Definition

In `src/schemas/index.ts`:

```typescript
export const experimentIds = [
	"search_and_replace",
	"experimentalDiffStrategy",
	"insert_content",
	"powerSteering",
	"apiLogging", // Added new experiment ID
] as const

const experimentsSchema = z.object({
	search_and_replace: z.boolean(),
	experimentalDiffStrategy: z.boolean(),
	insert_content: z.boolean(),
	powerSteering: z.boolean(),
	apiLogging: z.boolean(), // Added schema definition
})
```

### 3. Add Translations

Create a new file `webview-ui/src/i18n/locales/en/experimental.json`:

```json
{
	"API_LOGGING": {
		"name": "API Logging",
		"description": "Enable detailed logging of API requests and responses for debugging purposes."
	}
}
```

### 4. Update Tests

In `src/shared/__tests__/experiments.test.ts`:

```typescript
describe("isEnabled", () => {
	it("returns false when experiment is not enabled", () => {
		const experiments: Record<ExperimentId, boolean> = {
			powerSteering: false,
			experimentalDiffStrategy: false,
			search_and_replace: false,
			insert_content: false,
			apiLogging: false, // Added new experiment
		}
		expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(false)
	})
	// ... other test cases
})
```

### 5. Using the Experiment

In your code, you can check if the experiment is enabled:

```typescript
const experiments = context.globalState.get<Record<ExperimentId, boolean>>("experiments") ?? experimentDefault
const apiLoggingEnabled = experiments[EXPERIMENT_IDS.API_LOGGING] ?? false
```

## Best Practices

1. Use consistent naming across all files (e.g., `apiLogging` instead of `api_logging`)
2. Add the experiment to all test cases to ensure type safety
3. Use the `experimentDefault` object as a fallback when getting experiment values
4. Add descriptive translations for the experiment name and description
5. Document any breaking changes or dependencies

## Common Issues

1. Type mismatches between schema and API interface
2. Missing experiment in test cases
3. Inconsistent naming across files
4. Missing translations

## Testing

After adding a new experiment:

1. Run `npm run build` to check for type errors
2. Run tests to ensure all test cases pass
3. Test the experiment in the UI to verify it can be enabled/disabled
4. Verify the experiment's functionality works as expected

## Overview

The experiments system is a type-safe feature flag system that allows for:

- Gradual feature rollouts
- A/B testing
- Feature toggling
- Internationalization support
- Type-safe experiment management
- Default values for experiments

## Steps to Add a New Config Option

1. **Add the Experiment ID**

    In `src/shared/experiments.ts`, add your new experiment ID to the `EXPERIMENT_IDS` object:

    ```typescript
    export const EXPERIMENT_IDS = {
    	// ... existing experiments
    	YOUR_NEW_EXPERIMENT: "your_new_experiment_id",
    } as const
    ```

2. **Add the Schema Definition**

    In `src/schemas/index.ts`, add your experiment ID to the `experimentIds` array:

    ```typescript
    export const experimentIds = [
    	// ... existing experiment IDs
    	"your_new_experiment_id",
    ] as const
    ```

3. **Add Default Configuration**

    In `src/shared/experiments.ts`, add your experiment to the `experimentConfigsMap`:

    ```typescript
    export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
    	// ... existing experiments
    	YOUR_NEW_EXPERIMENT: { enabled: false },
    }
    ```

4. **Add Translations**

    Add translations for your experiment in all language files under `webview-ui/src/i18n/locales/`:

    ```json
    "experimental": {
        "YOUR_NEW_EXPERIMENT": {
            "name": "Use experimental feature name",
            "description": "Description of what this experimental feature does..."
        }
    }
    ```

5. **Using the Experiment**

    To check if your experiment is enabled in the code:

    ```typescript
    import { EXPERIMENT_IDS, experiments } from "../shared/experiments"

    if (experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.YOUR_NEW_EXPERIMENT)) {
    	// Your experimental feature code here
    }
    ```

## Example

Here's a complete example of adding a new experiment called "Smart Code Completion":

1. Add to `EXPERIMENT_IDS`:

    ```typescript
    export const EXPERIMENT_IDS = {
    	// ... existing experiments
    	SMART_COMPLETION: "smart_code_completion",
    }
    ```

2. Add to `experimentIds`:

    ```typescript
    export const experimentIds = [
    	// ... existing IDs
    	"smart_code_completion",
    ]
    ```

3. Add to `experimentConfigsMap`:

    ```typescript
    export const experimentConfigsMap = {
    	// ... existing configs
    	SMART_COMPLETION: { enabled: false },
    }
    ```

4. Add translations (example in English):

    ```json
    "experimental": {
        "SMART_COMPLETION": {
            "name": "Use smart code completion",
            "description": "Enable AI-powered code completion that understands context and provides more relevant suggestions."
        }
    }
    ```

5. Use in code:
    ```typescript
    if (experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.SMART_COMPLETION)) {
    	// Implement smart completion logic
    }
    ```

## Best Practices

1. Use descriptive names for your experiment IDs
2. Provide clear, user-friendly descriptions in translations
3. Set appropriate default values (usually `false` for new experiments)
4. Add tests for your experiment's functionality
5. Document any special considerations or risks in the experiment description
6. Consider adding a warning emoji (⚠️) in the UI for experimental features

## Testing

After adding a new experiment, you should:

1. Test the experiment toggle in the UI
2. Verify the experiment state is correctly persisted
3. Test the feature with both enabled and disabled states
4. Verify translations appear correctly in all supported languages
5. Add unit tests for the experiment's functionality

## Recent Example: API Logging Experiment

Here's a real example of adding the API Logging experiment:

1. Added to `EXPERIMENT_IDS` in `src/shared/experiments.ts`:

    ```typescript
    export const EXPERIMENT_IDS = {
    	// ... existing experiments
    	API_LOGGING: "api_logging",
    } as const
    ```

2. Added to `experimentIds` in `src/schemas/index.ts`:

    ```typescript
    export const experimentIds = [
    	// ... existing IDs
    	"api_logging",
    ] as const
    ```

3. Added to `experimentConfigsMap` in `src/shared/experiments.ts`:

    ```typescript
    export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
    	// ... existing experiments
    	API_LOGGING: { enabled: false },
    }
    ```

4. Added to `experimentsSchema` in `src/schemas/index.ts`:

    ```typescript
    const experimentsSchema = z.object({
    	// ... existing experiments
    	api_logging: z.boolean(),
    })
    ```

5. Added translations in `webview-ui/src/i18n/locales/en/experimental.json`:

    ```json
    {
    	"API_LOGGING": {
    		"name": "API Logging",
    		"description": "Enable detailed logging of API requests and responses for debugging purposes."
    	}
    }
    ```

6. Usage in code:
    ```typescript
    if (experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.API_LOGGING)) {
    	// API logging code here
    }
    ```
