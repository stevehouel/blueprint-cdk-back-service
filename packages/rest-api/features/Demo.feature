Feature: Demo
  As a DemoFactory user, I want to be able to interact with demo

  Background: Authentication
    Given I am authenticated

  Scenario: I list demos
    Given A demo that I created
    When I fetch a list of demos
    Then I get a 200 status
    Then I get a list of demos

  Scenario: I fetch one of my demo
    Given A demo that I created
    When I fetch the demo
    Then I get a 200 status
    Then I get the demo

  Scenario: I fetch a non-existent demo
    Given A demo doesn't exist
    When I fetch the demo
    Then I get a 404 status

  Scenario: I filter demos by user and status
    Given A demo that I created
    When I filter the demos list by user and status
    Then I get a 200 status
    Then I get a list of demos

  Scenario: I create a demo
    Given A demo that I created
    When I create a demo
    Then I get a 201 status
    Then I get the created demo

  Scenario: I update a demo
    Given A demo that I created
    When I update the demo
    Then I get a 200 status
    Then I get the updated demo
  
  Scenario: I delete a demo
    Given A demo that I created
    When I delete the demo
    Then I get a 204 status
  
 