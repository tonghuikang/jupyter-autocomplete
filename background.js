async function injectedFunction(apiKey, model) {
    // this function returns a string message
    let message = '';
    console.log('running injectedFunction');

    if (!apiKey) {
        alert("API key not set. Please configure it in the settings page.");
        return "openOptionsPage";
    }

    if (!apiKey) {
        alert("model not set. Please configure it in the settings page.");
        return "openOptionsPage";
    }

    if (typeof Jupyter === 'undefined' || !Jupyter.notebook) {
        alert('Jupyter notebook is not detected on this site.');
        return;
    }

    console.log('Attempting to process cell in classic Jupyter Notebook.');

    const selectedCell = Jupyter.notebook.get_selected_cell();
    if (!selectedCell) {
        console.error('No cell is currently selected.');
        alert('No cell is currently selected.');
        return;
    }

    const cellContent = selectedCell.get_text();
    let notebookContent = Jupyter.notebook.toJSON();
    let notebookString = JSON.stringify(notebookContent);

    const LENGTH_TO_ACTIVATE_TRUNCATION = 200000;
    if (notebookString.length > LENGTH_TO_ACTIVATE_TRUNCATION) {
        console.log('Inputs are truncated. Recommend notebook cleanup.');
        message += 'Inputs are truncated. Recommend notebook cleanup. ';

        function truncate(text, approximateLimit) {
            if (text.length > approximateLimit + 100) {
                const half = Math.floor((approximateLimit + 20) / 2);
                return text.substring(0, half) + '...' + text.substring(text.length - half);
            }
            return text;
        }

        const numCells = Jupyter.notebook.ncells();
        if (numCells > 0) {
            const maxPerCell = Math.floor(LENGTH_TO_ACTIVATE_TRUNCATION / numCells);
            console.log('maxPerCell', maxPerCell);

            notebookContent.cells.forEach(cell => {
                cell.source = truncate(cell.source, maxPerCell);
                console.log('cell', cell.source);
                console.log('cell', cell);
                
                if (Array.isArray(cell.outputs)) {
                    cell.outputs.forEach(output => {
                        output.text = truncate(output.text, maxPerCell);
                        console.log('output', output.text);
                    });
                }
            });
        }

        notebookString = JSON.stringify(notebookContent);
        notebookString = truncate(notebookString, LENGTH_TO_ACTIVATE_TRUNCATION);        
    }

    const data = {
        model: model,
        messages: [
            {
                role: "user",
                content:
                    "You will take the following notebook content as context: <notebook_context>" +
                    notebookString +
                    "</notebook_context>\n\n" +
                    "This is the current cell content <current_cell_content>" +
                    cellContent +
                    "</current_cell_content>\n\n" +
                    "If there are errors, fix the current cell based on the errors. Otherwise follow the instructions in the current cell. " +
                    "The content from your reply will replace the content in the cell. " +
                    "Make sure your response is executable python code. Explanation should be commented out. Never use ```python and ``` in your response."
            }
        ]
    };

    console.log('data', data);

    selectedCell.set_text(`${cellContent}\n\nGenerating response...`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.error) {
        console.error('Error from OpenAI:', result.error);
        alert('Error from OpenAI: ' + result.error.message);
        if (result.error.code === 'invalid_api_key') {
            return "openOptionsPage";
        }
        return;
    }
    console.log('Response from OpenAI:', result);

    if (!(result.choices && result.choices.length > 0)) {
        alert('No content generated from the API.');
        return;
    }

    const newCellContent = result.choices[0].message.content;
    console.log('newCellContent', newCellContent);

    selectedCell.set_text(newCellContent);
    console.log('Cell successfully processed.');
    message += 'Cell successfully processed. ';

    const completionTokens = result.usage.completion_tokens;
    const promptTokens = result.usage.prompt_tokens;

    const modelPricesPerMillionTokens = {
        'gpt-4o': { input: 5, output: 15 },
        'gpt-4o-2024-08-06': { input: 2.5, output: 10 },
        'gpt-4o-2024-05-13': { input: 5, output: 15 },
        'gpt-4o-mini': { input: 0.15, output: 0.6 },
        'chatgpt-4o-latest': { input: 5, output: 15 },
        'o1-preview': { input: 15, output: 60 },
        'o1-mini': { input: 3, output: 12 },
    };

    let costFormatted;
    if (modelPricesPerMillionTokens.hasOwnProperty(model)) {
        const prices = modelPricesPerMillionTokens[model];
        const cost = (promptTokens / 1e6) * prices.input + (completionTokens / 1e6) * prices.output;
        costFormatted = (cost * 100).toFixed(2);
    } else {
        costFormatted = 'unknown';
    }

    message += ' Estimated cost: ' + costFormatted + ' cents for ' + promptTokens + ' + ' + completionTokens + ' tokens.';
    return message;
}

async function executeInjectedFunction(tab) {
    const data = await chrome.storage.sync.get(['apiKey', 'model']);
    if (!data.apiKey || !data.model) {
        chrome.runtime.openOptionsPage();
        return;
    }
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectedFunction,
        args: [data.apiKey, data.model],
        world: 'MAIN'
    });
    console.log("injectedFunction results", results);
    let message = '';
    if (results && results[0] && results[0].result) {
        message = results[0].result;
    } else {
        console.log("message is empty");
    }
    if (message === "openOptionsPage") {
        chrome.runtime.openOptionsPage();
        return;
    }
    if (message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Success',
            message: message,
        });
        console.log("Cell processing completed.");
        return;
    }
    console.log("Invalid executeInjectedFunction outcome");
}

chrome.action.onClicked.addListener(async (tab) => {
    {{ executeInjectedFunction(tab) }}
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "execute-extension") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab) {
                {{ executeInjectedFunction(tab) }}
            }
        });
    }
});

