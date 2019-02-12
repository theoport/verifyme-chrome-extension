let domainUrl = "http://verifyme-env.2u7wgmmdxz.us-east-2.elasticbeanstalk.com";


chrome.storage.local.get(['wallet'], (result) => {
  let wallet = result.wallet;
  wallet != null ? 
    initWithWallet(wallet)
    : initWithoutWallet();
})

function initWithWallet(wallet) {
  $("#content").html(contentWithWallet(wallet))
  initEventHandlersWithWallet(wallet);
  allowInputOnCorrectDomain();
}

function initWithoutWallet() {
  $("#content").html(contentWithoutWallet());
  initEventHandlersWithoutWallet();
}

function allowInputOnCorrectDomain() {
  chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
    var url = tabs[0].url;
    if(url.substring(0, domainUrl.length + 18) == domainUrl + '/verifyCertificate') {
      $('#verifyButton').removeAttr('disabled');
      $('#verifyText').html('Type in your password and click verify to confirm your certificate');
    } else {
      $('#showPassword').html('');
    };  
  });
}

function contentWithWallet(wallet) {
  return '<div>'
    + '<div class="content notification">'
      + '<h4><i class="far fa-file"></i> My certificate</h4>' 
      + `<p>0x${wallet.address}</p>`
      + '<div class="field" id="showPassword">'
        + '<p class="control">'
          + '<input placeholder="password" class="input" type="password" id="walletPassword" />'
        + '</p>'
      + '</div>'
    + '<div class=" field is-grouped">'
      + '<p class="control"><button id="verifyButton" disabled class="button is-success"><span class="icon is-small"><i class="fa fa-check-double"></i></span><p>Verify</p></button></p>'
      + '<p class="control is-pulled-right"><button class="button is-danger"id="removeWallet"><span class="icon is-small"><i class="fa fa-times"></i></span><p>Clear certificate</p></button></p>'
    + '</div>'
    + '<div class="help"><i id="verifyText">You can only verify when requested by a verifyme prompt.</i></div>'
    + '</div></div>';

}

function contentWithoutWallet() {
  return '<div>'
    + '<div class="content notification">'
    + '<h4>Upload</h4>'
    + '<p>Please upload the keyfile that your verifyme certificate is issued to.</p>'
        + '<div class="field is-grouped file">'
          + '<label class="file-label control">'
            + '<input class="file-input" type="file" id="file">'
            + '<span class="file-cta">'
              + '<span id="fileIcon" class="file-icon">'
                + '<i class="fas fa-upload"></i>'
              + '</span>'
              + '<span id="fileText" class="file-label">Choose a file</span>'
            + '</span>'
          + '</label>'
          + '<p class="control"><button disabled class="button is-success" id="button">Submit</button></p>'
        + '</div>'
        + '<div class="help">File: <b id="fileName">No file</b></div>'
      + '</div>'
    + '</div>';
}

function initEventHandlersWithoutWallet() {

  $('#file').on('change', function() {
    if(this.files.length > 0)
    {
      $('#fileIcon').html('<i class="fa fa-file"></i>'); 
      $('#fileText').html('Change file');
      $('#fileName').html(this.files[0].name);
      $('#button').removeAttr('disabled');
    }
  });

  $('#button').on('click', function() {
    let reader  = new FileReader();

    reader.onload = function(){
      let data = JSON.parse(reader.result);
      chrome.storage.local.set({'wallet': data}, function() {
        window.location.reload();
      });
    };
    reader.readAsText($('#file')[0].files[0]);
  });
}

function initEventHandlersWithWallet(wallet) {

  $('#removeWallet').on('click', function() {
    chrome.storage.local.remove('wallet', () => {
      window.location.reload();
    });
  })

  $('#verifyButton').on('click', function() {
    let walletPassword = $('#walletPassword').val();
    disableButtonsInput();
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
      chrome.tabs.executeScript(tabs[0].id, {
        code: 'document.querySelector("#stringToBeSigned").textContent'
      }, ([data]) => verifyAge(data, walletPassword, wallet)) 
    });
  })
}

function verifyAge(stringToBeSigned, walletPassword, wallet) {
  signString(stringToBeSigned, walletPassword, wallet)
  .then(getVerificationToken)
  .then(sendVerification)
  .then(removeCurrentTab)
  .catch(processError)
}

function signString(string, password, wallet) {
  let obj = {"wallet": wallet, "password": password, "message": string};
  return new Promise((resolve, reject) => {
    $.ajax({
      type: 'POST',
      url: domainUrl +'/api/sign',
      data: JSON.stringify(obj),
      datatype: 'json',
      contentType: 'application/json',
      success: (responseData, textStatus, jqXHR) => {
        resolve({stringToBeSigned: string, signature: responseData});
      },
      error: (jqXHR, textStatus, errorThrown) => {
        reject(jqXHR.status);
      }
    })
  })
}

function getVerificationToken(signObj) {
  return new Promise((resolve, reject) => {
    $.ajax({
      type: 'POST',
      url: domainUrl +'/api/verify',
      data: JSON.stringify(signObj),
      datatype: 'json',
      contentType: 'application/json',
      success: (responseData, textStatus, jqXHR) => {
        resolve(responseData);
      },
      error: (jqXHR, textStatus, errorThrown) => {
        reject(jqXHR.status);
      }
    });
  });
}

function sendVerification(token) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
      chrome.tabs.executeScript(tabs[0].id, {
        code: 'document.querySelector("#destinationUrl").textContent'
      }, ([url]) => {
        $.ajax({
          type: 'POST',
          url,
          data: {token},
          datatype: 'text',
          success: (responseData, textStatus, jqXHR) => {
            resolve();
          },
          error: (jqXHR, textStatus, errorThrown) => {
            reject(jqXHR.status);
          }
        });
      });
    });
  });
}

function removeCurrentTab() {
  chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
    chrome.tabs.remove(tabs[0].id);
  })
}

function processError(status) {
  enableButtonsInput();
  $('#verifyText').html(`<p class="has-text-danger">${getErrorText(status)}</p>`);
}

function getErrorText(status) {
  switch(status) {
    case 406: return 'Your age certificate is invalid, please upload a valid one';
    case 410: return 'Something went wrong. Please try again by reloading the page you\'re trying to access';
    case 500: return 'Wrong password';
    default: return 'Something went wrong. Please try again later';
  }
  return `<p class="has-text-danger">${message}</p>`;
}

function enableButtonsInput() {
  $('#button').removeAttr('disabled');
  $('#verifyButton').removeAttr('disabled');
  $('#verifyButton')[0].classList.remove('is-loading');
  $('#walletPassword').removeAttr('disabled');
  $('#walletPassword').val("");
}

function disableButtonsInput() {
  $('#verifyButton')[0].classList.add("is-loading");
  $('#verifyButton').attr('disabled', true); 
  $('#button').attr('disabled', true); 
  $('#walletPassword').attr('disabled', true); 
}


