# Contributing to ALM plugin for Grafana


## Analyze Issues

Analyzing issue reports can be a lot of effort. Any help is welcome!
Go to [the Github issue tracker](https://github.com/SAP/alm-plug-in-for-grafana/issues?state=open) and find an open issue which needs additional work or a bugfix.


## Report an Issue

If you find a bug, you are welcome to report it.
Once you have familiarized with the guidelines, you can go to the [Github issue tracker for alm-plug-in-for-grafana](https://github.com/SAP/alm-plug-in-for-grafana/issues/new) to report the issue.

### Quick Checklist for Bug Reports

Issue report checklist:
 * Real, current bug
 * No duplicate
 * Reproducible
 * Good summary
 * Well-documented
 * Minimal example
 * Use the [template](ISSUE_TEMPLATE.md)


### Requirements for a bug report

These eight requirements are the mandatory base of a good bug report:
1. **Only real bugs**: Do not report:
   * issues caused by application code or any code outside ALM plug-in for Grafana.
   * something that behaves just different from what you expected. A bug is when something behaves different than specified. When in doubt, ask in a forum.
   * something you do not get to work properly. Use a support forum like stackoverflow to request help.
   * feature requests. Well, this is arguable: critical or easy-to-do enhancement suggestions are welcome, but we do not want to use the issue tracker as wishlist.
2. No duplicate: you have searched the issue tracker to make sure the bug has not yet been reported
3. Good summary: the summary should be specific to the issue
4. Current bug: the bug can be reproduced in the most current version (state the tested version!)
5. Reproducible bug: there are clear steps to reproduce given. This includes detailed and complete step-by-step instructions to reproduce the bug
6. Precise description: precisely state the expected and the actual behavior.
7. Minimal example: it is highly encouraged to provide a minimal example to reproduce.
8. Only one bug per report: open different tickets for different issues

You are encouraged to use [this template](ISSUE_TEMPLATE.md).

Please report bugs in English, so all users can understand them.



### Issue handling process

When an issue is reported, a committer will look at it and either confirm it as a real issue (by giving the "in progress" label), close it if it is not an issue, or ask for more details. In-progress issues are then either assigned to a committer in GitHub, reported in our internal issue handling system, or left open as "contribution welcome" for easy or not urgent fixes.

An issue that is about a real bug is closed as soon as the fix is committed. The closing comment explains which patch version(s) of ALM plug-in will contain the fix.





### Issue Reporting Disclaimer

We want to improve the quality of ALM plug-in and good bug reports are welcome! But our capacity is limited, 
so we cannot handle questions or consultation requests and we cannot afford to ask for required details. 
So we reserve the right to close or to not process insufficient bug reports in favor of those which are very cleanly 
documented and easy to reproduce. Even though we would like to solve each well-documented issue, there is always the chance that it won't happen - 
remember: ALM pulug-in for Grafana is Open Source and comes without warranty.

Bug report analysis support is very welcome! (e.g. pre-analysis or proposing solutions)


## Contribute Code

You are welcome to contribute code to ALM plug-in in order to fix bugs or to implement new features.

There are three important things to know:

1.  You must be aware of the Apache License (which describes contributions) and **agree to the Developer Certificate of Origin**. This is common practice in all major Open Source projects. To make this process as simple as possible, we are using *[CLA assistant](https://cla-assistant.io/)*. CLA assistant is an open source tool that integrates with GitHub very well and enables a one-click-experience for accepting the DCO. See the respective section below for details.
2.  There are **several requirements regarding code style, quality, and product standards** which need to be met (we also have to follow them). The respective section below gives more details on the coding guidelines.
3.  **Not all proposed contributions can be accepted**. Some features may e.g. just fit a third-party add-on better. The code must fit the overall direction of ALM plug-in for Grafana and really improve it, so there should be some "bang for the byte". For most bug fixes this is a given, but major feature implementation first need to be discussed with one of the ALM plug-in for Grafana committers (the top 20 or more of the [Contributors List](https://github.com/SAP/alm-plug-in-for-grafana/graphs/contributors)), possibly one who touched the related code recently. The more effort you invest, the better you should clarify in advance whether the contribution fits: the best way would be to just open an enhancement ticket in the issue tracker to discuss the feature you plan to implement (make it clear you intend to contribute). We will then forward the proposal to the respective code owner, this avoids disappointment.


### Developer Certificate of Origin (DCO)

Due to legal reasons, contributors will be asked to accept a DCO before they submit the first pull request to this project. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).  
This happens in an automated fashion during the submission process: the CLA assistant tool will add a comment to the pull request. Click it to check the DCO, then accept it on the following screen. CLA assistant will save this decision for upcoming contributions.

This DCO replaces the previously used CLA ("Contributor License Agreement") as well as the "Corporate Contributor License Agreement" with new terms which are well-known standards and hence easier to approve by legal departments. Contributors who had already accepted the CLA in the past may be asked once to accept the new DCO.


### Contribution Content Guidelines

Contributed content can be accepted if it:

1. is useful to improve ALM plug-in for Grafana (explained above)
2. follows the applicable guidelines and standards

### How to contribute - the Process

1.  Make sure the change would be welcome (e.g. a bugfix or a useful feature); best do so by proposing it in a GitHub issue
2.  Create a branch forking the alm-plug-in-for-grafana repository and do your change
3.  Commit and push your changes on that branch
    -   When you have several commits, squash them into one (see [this explanation](http://davidwalsh.name/squash-commits-git)) - this also needs to be done when additional changes are required after the code review

4.  In the commit message follow the [commit message guidelines](docs/guidelines.md#git-guidelines)
5.  If your change fixes an issue reported at GitHub, add the following line to the commit message:
    - ```Fixes https://github.com/SAP/alm-plug-in-for-grafana/issues/(issueNumber)```
    - Do NOT add a colon after "Fixes" - this prevents automatic closing.
	- When your pull request number is known (e.g. because you enhance a pull request after a code review), you can also add the line ```Closes https://github.com/SAP/alm-plug-in-for-grafana/pull/(pullRequestNumber)```
6.  Create a Pull Request to github.com/SAP/alm-plug-in-for-grafana
7.  Follow the link posted by the CLA assistant to your pull request and accept the Developer Certificate of Origin, as described in detail above.
8.  Wait for our code review and approval, possibly enhancing your change on request
9.  Once the change has been approved we will inform you in a comment
10.  Your pull request cannot be merged directly into the branch (internal SAP processes), but will be merged internally and immediately appear in the public repository as well. Pull requests for non-code branches can be directly merged.
11.  We will close the pull request, feel free to delete the now obsolete branch
