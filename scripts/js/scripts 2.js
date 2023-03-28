function openNav() {
    document.getElementById("mySidenav").style.width = "250px";
    document.getElementById("main").style.marginLeft = "250px";
  }

  function closeNav() {
    document.getElementById("mySidenav").style.width = "0";
    document.getElementById("main").style.marginLeft= "0";
  }

  function checkboxToggled() {
    // Get the checkbox
    var checkBox = document.getElementById("myCheck");
    // Get the output text
    var text = document.getElementById("text");
  
    // If the checkbox is checked, display the output text
    if (checkBox.checked == true){
      text.style.display = "block";
    } else {
      text.style.display = "none";
    }
  } 

  function sb_open() {
    document.getElementById("mySidenav").style.width = "250px";
    document.getElementById("map-display").style.marginLeft = "250px";
    document.getElementById("button").style.display = "none";
    document.getElementById("button2").style.display ="inline-block";
    document.getElementById("map").style.marginLeft ="250px";
    document.getElementById("map").style.width ="calc(100% - 250px)";
  }
  
  function sb_close() {
    document.getElementById("mySidenav").style.width = "0";
    document.getElementById("map-display").style.marginLeft= "0";
    document.getElementById("button").style.display ="inline-block";
    document.getElementById("button").style.visibility = "visible";
    document.getElementById("button2").style.display = "none";
    document.getElementById("map").style.marginLeft ="0";
    document.getElementById("map").style.width ="100%";
   }