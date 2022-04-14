Feature: Feedback
  As a DemoFactory user i can submit feedback.

  Background: Authentication
    Given I am authenticated

  Scenario: I can submit a feedback
    When I create a new feedback
    Then I get a 202 status