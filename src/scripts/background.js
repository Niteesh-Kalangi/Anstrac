

if(typeof browser !== "undefined"){
	var qtest = browser.sidebarAction;
	if(typeof qtest !== "undefined"){
		browser.browserAction.onClicked.addListener(function(){
			browser.sidebarAction.toggle();
		});
	}
}


chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch((error) => console.error(error));

// Initialize chat history
let chatHistory;

// Listen for when the extension is installed
chrome.runtime.onInstalled.addListener(function () {
    // Set default API model
    let defaultModel = "gpt-3.5-turbo-1106";
    chrome.storage.local.set({ apiModel: defaultModel });

    // Set empty chat history
    chrome.storage.local.set({ chatHistory: [] });

    // Open the options page
    chrome.runtime.openOptionsPage();
});

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener(async function (message, sender, sendResponse) {

    if (message.userInput) {

        // Get the API key from local storage
        const { apiKey } = await getStorageData(["apiKey"]);
        // Get the model from local storage
        const { apiModel } = await getStorageData(["apiModel"]);

        // get the chat history from local storage
        const result = await getStorageData(["chatHistory"]);

        if (!result.chatHistory || result.chatHistory.length === 0) {
            chatHistory = [
                { role: "system", content: "I'm your helpful chat bot! I provide helpful and concise answers." },
            ];
        } else {
            chatHistory = result.chatHistory;
        }

        // save user's message to message array
        chatHistory.push({ role: "user", content: message.userInput });

        if (apiModel === "dall-e-3") {
            // Send the user's message to the OpenAI API
            const response = await fetchImage(message.userInput, apiKey, apiModel);

            if (response && response.data && response.data.length > 0) {
                // Get the image URL
                const imageUrl = response.data[0].url;

                // Add the assistant's response to the message array
                chatHistory.push({ role: "assistant", content: imageUrl });

                // save message array to local storage
                chrome.storage.local.set({ chatHistory: chatHistory });

                // Send the image URL to the popup script
                chrome.runtime.sendMessage({ imageUrl: imageUrl });

                console.log("Sent image URL to popup:", imageUrl);
            }
            return true; // Enable response callback
        } else {
            // Send the user's message to the OpenAI API
            const response = await fetchChatCompletion(chatHistory, apiKey, apiModel);

            if (response && response.choices && response.choices.length > 0) {

                // Get the assistant's response
                const assistantResponse = response.choices[0].message.content;

                // Add the assistant's response to the message array
                chatHistory.push({ role: "assistant", content: assistantResponse });

                // save message array to local storage
                chrome.storage.local.set({ chatHistory: chatHistory });

                // Send the assistant's response to the popup script
                chrome.runtime.sendMessage({ answer: assistantResponse });

                console.log("Sent response to popup:", assistantResponse);
            }
            return true; // Enable response callback
        }
    }

    return true; // Enable response callback
});

// Fetch data from the OpenAI Chat Completion API
async function fetchChatCompletion(messages, apiKey, apiModel) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                "messages": messages,
                "model": apiModel,
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized - Incorrect API key
                throw new Error("Looks like your API key is incorrect. Please check your API key and try again.");
            } else {
                throw new Error(`Failed to fetch. Status code: ${response.status}`);
            }
        }

        return await response.json();
    } catch (error) {
        // Send a response to the popup script
        chrome.runtime.sendMessage({ error: error.message });

        console.error(error);
    }
}

// Fetch Image from the OpenAI DALL-E API
async function fetchImage(prompt, apiKey, apiModel) {
    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                "prompt": prompt,
                "model": apiModel,
                "n": 1,
                "size": "1024x1024",
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized - Incorrect API key
                throw new Error("Looks like your API key is incorrect. Please check your API key and try again.");
            } else {
                throw new Error(`Failed to fetch. Status code: ${response.status}`);
            }
        }

        return await response.json();
    } catch (error) {
        // Send a response to the popup script
        chrome.runtime.sendMessage({ error: error.message });

        console.error(error);
    }
}

// Get data from local storage
function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result));
    });
}


//code capture functionality

console.log("start")

// To store OCR resuls from content.js
const OCRResult = {
    img: null,
    confidence: null,
    text: null
}


var notification_ids = []


// Chrome APIs

/*chrome.action.onClicked.addListener(async function(tab){

    let injected_flag = await CheckIfScriptAlreadyInjected(tab.id)

    // true - already injected
    // flase - not injected

    if (!injected_flag){
        await InjectScripts(tab.id)
    }
    
})*/

chrome.commands.onCommand.addListener(async function(command, tab){
    //console.log("fakap")
    if(command === "take-screenshot") {
        let injected_flag = await CheckIfScriptAlreadyInjected(tab.id)

        
        console.log("ha");

        if (!injected_flag){
            await InjectScripts(tab.id)
        }
        
       console.log("fakap")
    }
    
})

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    switch (message.type) {
        case "get_viewport_screenshot":
            GetViewportScreenshot().then(sendResponse)
            return true
            break

        case "create_text_noti":
            CreateTextNotification(message.msg)
            break

        case "create_ocr_result_noti":
            OCRResult.img = message.img
            OCRResult.confidence = message.confidence
            OCRResult.text = message.text
            console.log(OCRResult.confidence);
            CreateOCRResultNotification(message.confidence)
            break

        case "activate_icon":
            ActivateIcon()
            break

        case "deactivate_icon":
            DeactivateIcon()
            break

    }

})


function GetViewportScreenshot(){
    return new Promise(function(resolve,reject){

        setTimeout(function(){
            chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT,{format:"png"},function(viewport_screenshot){
                if(viewport_screenshot){resolve(viewport_screenshot)}
                
            })
        },50)

    })

}


/*async function InjectScripts(tabId){
    let css_files = ["styles/content.css","packages/jquery.Jcrop.min.css"]
    await chrome.scripting.insertCSS({files: css_files, target: {tabId: tabId}})

    let js_files = ["packages/tesseract.min.js","packages/jquery.min.js","packages/jquery.Jcrop.min.js","scripts/content.js"]
    await chrome.scripting.executeScript({files: js_files, target: {tabId: tabId}})
}*/

async function InjectScripts(tabId) {
    let css_files = ["styles/content.css", "packages/jquery.Jcrop.min.css"];
    try {
        await chrome.scripting.insertCSS({files: css_files, target: {tabId: tabId}});
    } catch (error) {
        //console.error("Error injecting CSS:", error)
        CreateTextNotification("Couldn't start script")
    }

    let js_files = ["packages/tesseract.min.js", "packages/jquery.min.js", "packages/jquery.Jcrop.min.js", "scripts/content.js"];
    try {
        await chrome.scripting.executeScript({files: js_files, target: {tabId: tabId}});
    } catch (error) {
        console.error("Error injecting JavaScript:", error)
        CreateTextNotification("Couldn't start script")
    }
}

let isContentScriptReady = false;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.ready) {
        isContentScriptReady = true;
    }
});

/*function CheckIfScriptAlreadyInjected(tabId){
    return new Promise(function(resolve,reject){
        
        chrome.tabs.sendMessage(tabId,{type:"init"}, function(response){
            
            if (response){  // Script already injected
                resolve(true)
            } else {
                resolve(false) // Script not injected
            }
        })

        

    })

}
*/

/*function CheckIfScriptAlreadyInjected(tabId) {
    return new Promise(function(resolve, reject) {
        chrome.tabs.sendMessage(tabId, {type: "init"}, function(response) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                resolve(false); // Script not injected or not ready
            } else if (response) {
                resolve(true); // Script already injected
            } else {
                resolve(false); // Script not injected
            }
        });
    });
}*/

async function CheckIfScriptAlreadyInjected(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {type: "init"});
        // If the response is received, it means the script is already injected
        return true;
    } catch (error) {
        // If there's an error (e.g., the receiving end does not exist), it means the script is not injected
        if (error.message === "Could not establish connection. Receiving end does not exist.") {
            return false;
        } else {
            // Handle other errors
            console.error("Error checking if script is already injected:", error);
            throw error; // Rethrow the error if it's not the expected one
        }
    }
}




// Chrome Notifications

function CreateTextNotification(msg){

    // Clear all previous notifications

    notification_ids.forEach(function(id){
        setTimeout(function(){chrome.notifications.clear(id)},500)
    })

    notification_ids = []

    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../DisplayIcons/128.png',
        title: chrome.runtime.getManifest().name,
        message: msg
    },function(id){
        notification_ids.push(id)
    })

}

function CreateOCRResultNotification(confidence){
    // Clear all previous notifications (newly added)
    /*
    notification_ids.forEach(function(id){
        setTimeout(function(){chrome.notifications.clear(id)},500)
    })
    */
    notification_ids.forEach(function(id){
        setTimeout(function(){chrome.notifications.clear(id)},500)
    })

    notification_ids = []

    console.log("reached OCR noti")
    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../DisplayIcons/128.png',
        title: "OCR Complete",
        message: `Confidence: ${confidence}
Text Copied to Clipboard`,
        buttons: [
            {title: "Compare Side by Side"}
        ],
        requireInteraction: false
      },function(id){
            notification_ids.push(id)
      })


    
}

chrome.notifications.onButtonClicked.addListener(async function(noti_id,btn_index){
    // 0 - Open Side by Side UI

    switch(btn_index){

        case 0:
            await chrome.tabs.create({ url: "../sidebysideUI/index.html"})
            break

    }

})



function GetCurrentTabId(){
    return new Promise(function(resolve,reject){

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            resolve(tabs[0].id)
        })

    })
}


// Toggle Icons

function ActivateIcon(){
    chrome.action.setIcon({ path: "../DisplayIcons/16-blue.png"});

}

function DeactivateIcon(){
    chrome.action.setIcon({ path: "../DisplayIcons/16.png"});
}

