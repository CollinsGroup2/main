<?php
    //Start session to store API metadata
    session_start();
    require "productsearch.php";
    require "authorisation.php";
    require "productquery.php";
    
    authorisation();//authorisation of the toolset

    $pgId = $_GET["page"] ?? null;
    $missions = initialSearch($pgId);

    $missionData = array();

    foreach($missions['missions'] as $mission)
    {
        $missionData[] = productQuery($mission);
    }

    Header("Content-Type: application/json");
    echo json_encode(array(
        "missions" => $missionData,
        "paginationID" => $missions["paginationID"]
    ));
