<?php
    //Start session to store API metadata
    session_start();
    require "productsearch.php";
    require "authorisation.php";
    require "productquery.php";
    
    authorisation();//authorisation of the toolset
    initialSearch();//get product id's

    $missionData = array();

    foreach($_SESSION['missions'] as $mission)
    {
        $missionData[] = productQuery($mission);
    }

    Header("Content-Type: application/json");
    echo json_encode($missionData);
