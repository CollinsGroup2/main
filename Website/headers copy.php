<?php
    //Start session to store API metadata
    session_start();
    require "productsearch.php";
    require "authorisation.php";
    require "productquery.php";
    
    authorisation();//authorisation of the toolset
    initialSearch();//get product id's

    //loop session array missions and retrieve relative metadata linked to product id's
    foreach ($_SESSION['missions'] as $mission) 
    {
        productQuery($mission);
    }
