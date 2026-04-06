@e2e @framework-app
Feature: Framework app (BDD)

  Background:
    Given I navigate to the home screen

  @smoke @web @android @ios
  Scenario: Home screen renders on every platform
    Then I should see the element "home-scroll"
    And I should see the element "home-content"
    And I should see the element "home-title"
    And I should see the element "home-card"
    And I should see the text "Spana Demo"

  @web @android
  Scenario: Navigate to tabs explore through the UI
    Then I should see the navigation menu button
    When I open the navigation menu
    Then I should see the element "drawer-tabs-item" within 10000ms
    When I tap the "drawer-tabs-item" drawer item
    Then I should see the element "tab-one-title"
    When I tap the "Open explore tab" tab
    Then I should see the element "tab-two-title"
    And the element "tab-two-subtitle" should have text "Browse more of the Spana demo experience"

  @showcase @web @android @ios
  Scenario: Playground text input and toggle
    Given I navigate to "/playground"
    Then I should see the element "playground-title" within 10000ms
    When I type "Hello BDD" into the "playground-input" field
    Then the element "playground-input-mirror" should have text "Hello BDD"
    When I tap the "playground-toggle" element
    Then I should see the element "playground-details-text"

  @web @android @ios
  Scenario Outline: Direct route navigation to <screen>
    Given I navigate to "<path>"
    Then I should see the element "<selector>" within 15000ms
    When I take a screenshot named "<screen>"

    Examples:
      | screen       | path            | selector       |
      | home         | /               | home-title        |
      | tabs-home    | /(drawer)/(tabs)| tab-one-title     |
      | tabs-explore | /two            | tab-two-title     |
      | modal        | /modal          | modal-title       |
      | playground   | /playground     | playground-title  |
