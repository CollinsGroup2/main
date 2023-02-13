<?php

function productQuery($productID)
{
    $ch = curl_init(); //Initialise a cURL object

    curl_setopt($ch, CURLOPT_URL, "https://hallam.sci-toolset.com/discover/api/v1/products/" . $productID); //Host of sci-toolset and product query

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); //Allows the return of JSON data
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); //Stop cURL from verifying the peer's certificate.
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false); //Stop cURL from verifying the peer's certificate against the provided hostname

    //Set headers based on API documentation
    $headers = array(

        'Content-Type: application/json',
        'Authorization: Bearer ' . $_SESSION["token"],
        'Accept: */*',
        'Host: localhost'
    );
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers); //set headers to cURL object

    //Execute the curl request and assign returned data to session variable
    $response = curl_exec($ch);

    //Close the cURL session and free all resources.
    curl_close($ch);

    $data = json_decode($response, true);

    //Seperate access_token

    print_r($data['product']['result']['centre']);
    
  
}
