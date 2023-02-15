<?php
//Gain access to the API via authenticating with the toolset (SCI-Toolset API Documentation 1.1)

function authorisation()
{
    //------------------------------------------------------- cURL Object creation ----------------------------------------------------------
    $ch = curl_init(); //Initialise a cURL object

    curl_setopt($ch, CURLOPT_URL, "https://hallam.sci-toolset.com/api/v1/token"); //Host of sci-toolset and access token
    curl_setopt($ch, CURLOPT_POST, true); //Regular HTTP post set to true, uses Content-Type: application/x-www-form-urlencoded" header
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); //Allows the return of JSON data
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); //Stop cURL from verifying the peer's certificate.
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false); //Stop cURL from verifying the peer's certificate against the provided hostname

    //Set headers based on API documentation
    $headers = array(
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: */*',
        'Host: localhost'
    );
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers); //set headers to cURL object

    //Set URL query username and password
    $query = "grant_type=password&username=hallam1&password=!H%25j50H2"; //modify password to allow non safe URL characters
    curl_setopt($ch, CURLOPT_POSTFIELDS, $query); //Set query to cURL object

    //Set string variables client id and client secret 
    $clientID = "sci-toolset";
    $clientSecret = "st";
    curl_setopt($ch, CURLOPT_USERPWD, "$clientID:$clientSecret"); //Set additional query to cURL object

    //------------------------------------------- cURL object execution and seperation --------------------------------------------------------

    //Execute the curl request and assign returned data to session variable
    $_SESSION["response"] = curl_exec($ch);

    //Close the cURL session and free all resources.
    curl_close($ch);

    //Seperate access token from returned JSON 
    $_SESSION["objJSON"] = json_decode($_SESSION["response"]); //Decode returned JSON
    $_SESSION["token"] = $_SESSION["objJSON"]->access_token; //Seperate access_token
}