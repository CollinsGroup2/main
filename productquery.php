<?php

function productQuery($mission)
{
    $ch = curl_init(); //Initialise a cURL object

    curl_setopt($ch, CURLOPT_URL, "https://hallam.sci-toolset.com/discover/api/v1/products/" . $mission); //Host of sci-toolset and product query

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

    //$data = json_decode($response, true);
    $data = json_decode($response, true);

    //seperate relevent metadata 
    $id = $data['product']['result']['identifier'];
    $centre = $data['product']['result']['centre'];
    $dateCreated = $data['product']['result']['datemodified'];
    $dateModified = $data['product']['result']['datemodified'];
    $type = $data['product']['result']['type'];
    $footprinttype = $data['product']['result']['footprint']['type'];
    $coords = $data['product']['result']['footprint']['coordinates'];

    //assign metadata to relevent array and encode to json string
    $productData = array(
        $id,
        $centre,
        $dateCreated,
        $dateModified,
        $footprinttype,
        $coords,
        $type
    );

    return $productData;
}
