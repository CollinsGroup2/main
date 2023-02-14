<?php
//Generates search requests, via a POST, containing the search criteria in JSON format (SCI-Toolset API Documentation 1.2)

//------------------------------------------------------- cURL Object creation ----------------------------------------------------------

const REQUEST_SIZE = 150;

function initialSearch($pgID = null)
{
    $ch = curl_init(); //Initialise a cURL object

    if ($pgID === null) {
        curl_setopt($ch, CURLOPT_URL, "https://hallam.sci-toolset.com/discover/api/v1/products/search"); //Host of sci-toolset and product search
        curl_setopt($ch, CURLOPT_POST, true); //Regular HTTP post set to true, uses Content-Type: application/x-www-form-urlencoded" header
    } else {
        curl_setopt($ch, CURLOPT_URL, "https://hallam.sci-toolset.com/discover/api/v1/products/page/" . urlencode($pgID)); //Host of sci-toolset and product search
    }
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

    if ($pgID === null) {
        //Set URL payload to grab all id's, 121 results
        $payload = json_encode(array("size" => REQUEST_SIZE));
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload); //Set query to cURL object
    }

    //Execute the curl request and assign returned data to session variable
    $_SESSION["response"] = curl_exec($ch);

    //Close the cURL session and free all resources.
    curl_close($ch);

    //convert JSON string to associative array
    $jsonArray =  json_decode($_SESSION["response"],true);
    //Declare array to hold just id values
    $missions = array();
    //loop JSON array
    foreach ($jsonArray as $value)
    {
        foreach ($value as $sub_val) 
        {
            $i = 0;
            foreach ($sub_val as $sub_val2)
            {
                
                if(is_array($sub_val2))
                {
                    //store id in array
                    $missions[$i] = $sub_val2["id"];
                    $i++;
                }
            }
        }
    }

    return array(
        "missions" => $missions,
        "paginationID" => count($missions) >= REQUEST_SIZE ? $jsonArray["paginationId"] : null
    );
}
?>