let defaultPreference = {
  urlFilterList: [],
  version: 1
};
let preferences = {};
let retry = 0;

const storageChangeHandler = (changes, area) => {
  if(area === 'local') {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      preferences[item] = changes[item].newValue;
    }
  }
};

const loadPreference = () => {
  chrome.storage.local.get(results => {
    if ((typeof results.length === 'number') && (results.length > 0)) {
      results = results[0];
    }
    if (!results.version) {
      preferences = defaultPreference;
      chrome.storage.local.set(defaultPreference, res => {
        chrome.storage.onChanged.addListener(storageChangeHandler);
      });
    } else {
      preferences = results;
      chrome.storage.onChanged.addListener(storageChangeHandler);
    }

    if (preferences.version !== defaultPreference.version) {
      let update = {};
      let needUpdate = false;
      for(let p in defaultPreference) {
        if(preferences[p] === undefined) {
          update[p] = defaultPreference[p];
          needUpdate = true;
        }
      }
      if(needUpdate) {
        update.version = defaultPreference.version;
        chrome.storage.local.set(update);
      }
    }
  });
};

const tryConnection = () => {
  chrome.runtime.sendMessage('PopupWindow@ettoolong', {action: 'ack'}, response => {
    if(response && response.result === 'ok') {
      chrome.tabs.query({windowType:'normal'}, tabs => {
        for (let tab of tabs) {
          urlFilter(tab.url);
        }
      });
    } else {
      retry++;
      if(retry < 20) {
        setTimeout(tryConnection, 1000);
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', event => {
  loadPreference();
  setTimeout(tryConnection, 1000);
});

const urlFilter = url => {
  if(preferences.urlFilterList) {
    for (let filter of preferences.urlFilterList) {
      if (filter.url.includes('*')) {
        let p = filter.url.replace(/(\W)/ig, '\\$1').replace(/\\\*/ig, '*').replace(/\*/ig, '.*');
        let re = new RegExp('^' + p + '$', 'ig');
        if (url.match(re) !== null) {
          return true;
        }
      }
      else if (url === filter.url) {
        return true;
      }
    }
  }
  return false;
};

chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tabInfo) => {
  console.log(tabId, tabInfo)
  if(changeInfo.url) {
    if(urlFilter(changeInfo.url)) {
      chrome.windows.get(tabInfo.windowId, win => {
        if (win.type === 'normal') {
          chrome.runtime.sendMessage('PopupWindow@ettoolong', {
            action: 'popupWindow',
            tabId: tabId
          });
        }
      });
    }
  }
});
