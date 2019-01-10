
let wallet;

chrome.storage.local.get(['wallet'], (result) => {
  wallet = result.wallet;
  $("#content").html(wallet != null ?
    contentWithWallet(wallet)
    : contentWithoutWallet());
  if (wallet == null) {
    eventsWithoutWallet();
  } else {
    eventsWithWallet();
    queryTabs();
  }
});

function queryTabs() {
  chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
    var url = tabs[0].url;
    if(url.substring(0,39) == "http://localhost:8080/verifyCertificate") {
      $('#verifyButton').removeAttr("disabled");
      $('#verifyText').html("Type in your password and click verify to confirm your certificate");
    } else {
      $('#showPassword').html("");
    };  
  });
}

function contentWithWallet(wallet) {
  return "<di>"
    + "<div class=\"content notification\">"
    + "<h4><i class=\"far fa-file\"></i> My certificate</h4>" 
    + "<p>0x" + wallet.address + "</p>"
    + "<div class=\"field\" id=\"showPassword\">"
    + "<p class=\"control\">"
    + "<input placeholder=\"password\" class=\"input\" type=\"password\" id=\"walletPassword\" />"
    + "</p>"
    + "</div>"
    + "<div class=\" field is-grouped\">"
    + "<p class=\"control\"><button id=\"verifyButton\" disabled class=\"button is-success\"><span class=\"icon is-small\"><i class=\"fa fa-check-double\"></i></span><p>Verify</p></button></p>"
    + "<p class=\"control is-pulled-right\"><button class=\"button is-danger\"id=\"removeWallet\"><span class=\"icon is-small\"><i class=\"fa fa-times\"></i></span><p>Clear certificate</p></button></p>"
    + "</div><div class=\"help\"><i id=\"verifyText\">You can only verify when requested by a verifyme prompt.</i></div>"
    + "</div></div>";

}

function contentWithoutWallet() {
  return "<div>"
    + "<div class=\"content notification\">"
    + "<h4>Upload</h4>"
    + "<p>Please upload the keyfile that your verifyme certificate is issued to.</p>"
        + "<div class=\"field is-grouped file\">"
          + "<label class=\"file-label control\">"
            + "<input class=\"file-input\" type=\"file\" id=\"file\">"
            + "<span class=\"file-cta\">"
              + "<span id=\"fileIcon\" class=\"file-icon\">"
                + "<i class=\"fas fa-upload\"></i>"
              + "</span>"
              + "<span id=\"fileText\" class=\"file-label\">"
                + "Choose a file"
              + "</span>"
            + "</span>"
          + "</label>"
          + "<p class=\"control\"><button disabled class=\"button is-success\" id=\"button\">Submit</button></p>"
        + "</div>"
        + "<div class=\"help\">File: <b id=\"fileName\">No file</b></div>"
      + "</div>"
    + "</div>";
}

function eventsWithoutWallet() {
  var file = document.getElementById("file");
  file.onchange = function(){
    if(file.files.length > 0)
    {
      document.getElementById('fileIcon').innerHTML = "<i class=\"fa fa-file\"></i>"; 
      document.getElementById('fileText').innerHTML = "Change file";
      document.getElementById('fileName').innerHTML = file.files[0].name;
      document.getElementById('button').removeAttribute("disabled");
    }
  };
  let button = document.getElementById("button");
  button.onclick = function (){
    let file    = document.querySelector('input[type=file]').files[0]; //sames as here
    let reader  = new FileReader();

    reader.onload = function(){
      let data = JSON.parse(reader.result);
      chrome.storage.local.set({"wallet": data}, function() {
        window.location.reload();
      });

    };
    reader.readAsText(file);
  }
}

function eventsWithWallet() {

  let verify = $("#verifyButton");
  let button = $("#removeWallet");

  function signString(string, destinationUrl) {
    let password = $("#walletPassword").val();
    let obj = {"wallet": wallet, "password": password, "message": string[0]};
    $.ajax({
      type: 'POST',
      url: 'http://localhost:8080/api/sign',
      data: JSON.stringify(obj),
      datatype: 'json',
      contentType: 'application/json',
      success: (responseData, textStatus, jqXHR) => {
        getVerificationToken(responseData, string[0], destinationUrl[0]);
      },
      error: (jqXHR, textStatus, errorThrown) => {
        if (jqXHR.status == 0) serverDown();
        else if (jqXHR.status == 500) wrongPassword();
        else somethingWrong();
      }
    })
  }

  function getVerificationToken(signature, stringToBeSigned, destinationUrl) {
    $.ajax({
      type: 'POST',
      url: 'http://localhost:8080/api/verify',
      data: JSON.stringify({stringToBeSigned, signature}),
      datatype: 'json',
      contentType: 'application/json',
      success: (responseData, textStatus, jqXHR) => {
        sendVerification(responseData, destinationUrl);
      },
      error: (jqXHR, textStatus, errorThrown) => {
        if (jqXHR.status == 0) serverDown();
        else if (jqXHR.status == 406) noCertificate();
        else if (jqXHR.status == 410) alreadySigned();
        else somethingWrong();
        ;
      }
    });
  }

  function sendVerification(token, url) {
    $.ajax({
      type: 'POST',
      url,
      data: {token},
      datatype: 'text',
      success: (responseData, textStatus, jqXHR) => {
        chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
          chrome.tabs.remove(tabs[0].id);
        })
      },
      error: (jqXHR, textStatus, errorThrown) => {
        invalidToken();
      }
    });
  }

  function noCertificate() {
    enableButtonsInput();
    $('#verifyText').html("<p class=\"has-text-danger\">Your age certificate is invalid, please upload a valid one</p>");
  }
  function serverDown() {
    enableButtonsInput();
    $('#verifyText').html("<p class=\"has-text-danger\">Something went wrong. Please try again later</p>");
  }
  function somethingWrong() {
    enableButtonsInput();
      $('#verifyText').html("<p class=\"has-text-danger\">Something went wrong. Please try again later</p>");
  }
  function alreadySigned() {
    enableButtonsInput();
      $('#verifyText').html("<p class=\"has-text-danger\">Something went wrong. Please try again by reloading the page you're trying to access</p>");
  }

  function invalidToken() {
    enableButtonsInput();
      $('#verifyText').html("<p class=\"has-text-danger\">Something went wrong. Please try again by reloading the page you're trying to access</p>");
  }

  function wrongPassword() {
    enableButtonsInput();
      $('#verifyText').html("<p class=\"has-text-danger\">Wrong password</p>");
  }

  function enableButtonsInput() {
    button.removeAttr("disabled");
    verify.removeAttr("disabled");
    verify[0].classList.remove("is-loading");
    $("#walletPassword").removeAttr("disabled");
    $("#walletPassword").val("");
  }

  function disableButtonsInput() {
    verify[0].classList.add("is-loading");
    verify.attr("disabled", true); 
    button.attr("disabled", true); 
    $("#walletPassword").attr("disabled", true); 
  }

  button.click(function() {
    chrome.storage.local.remove("wallet", () => {
      window.location.reload();
    });
  })

  verify.click(function() {
    disableButtonsInput();
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
      chrome.tabs.executeScript(tabs[0].id, {
        code: 'document.querySelector("#destinationUrl").textContent'
      }, (destinationUrl) => {
            chrome.tabs.executeScript(tabs[0].id, {
              code: 'document.querySelector("#stringToBeSigned").textContent'
            }, (data) => signString(data, destinationUrl));
        });
    });
  })

}
