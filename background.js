async function injectedFunction(apiKey, model) {
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
    const notebookContent = Jupyter.notebook.toJSON();
    const notebookString = JSON.stringify(notebookContent);
    console.log('Notebook content as string:', notebookString);

    const data = {
        model: model,
        messages: [
            {
                role: "user",
                content:
                    "You will take the following notebook content as context: <notebook_context>" +
                    notebookString +
                    "</notebook_context>\n\n" +
                    "This is the current cell information <current_cell_information>" +
                    cellContent +
                    "</current_cell_information>\n\n" +
                    "If there are errors, fix the current cell based on the errors. Otherwise follow the instructions in the current cell. " +
                    "The content from your reply will replace the content in the cell. " +
                    "Make sure your response is executable python code. Explanation should be commented out. Do not include ```python and ```."
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
    console.log('Cell processed successfully.');
    alert('Cell processed successfully.');
}

async function executeInjectedFunction(tab) {
    const data = await chrome.storage.sync.get(['apiKey', 'model']);
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectedFunction,
        args: [data.apiKey, data.model],
        world: 'MAIN'
    });
    if (results && results[0].result === "openOptionsPage") {
        chrome.runtime.openOptionsPage();
    }
    console.log("Cell processing completed.");
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

