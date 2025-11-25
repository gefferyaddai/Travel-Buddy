//on click

const users = {
    geffery1: { password: "1234" },
    testUser: { password: "abcd1234" }
};


// document.addEventListener("click", (e) => login()) runs click anytime
// works
function login(){
    let username = document.getElementById("Username-input").value;
    let password = document.getElementById("Password-input").value;
    if (username in users && password === users[username].password) {
       console.log("tester tester ");
       console.log(username);
        console.log(password);
    }
    else{

        return false

    }
    return true
}
function loginState(){
    //if checkbox clickd and login() == true then
}
function signup(){
  //  let username = document.getElementById("").value
    // let password = document.getElementById("").value

}
signup()

