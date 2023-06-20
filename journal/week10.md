# Week 10 — CloudFormation Part 1

## Starting the week by writing a template.yaml file

```yaml
AWSTemplateFormatVersion: "2010-09-09"
```

- its a good idea to have smaller templates with each tier separate

  - easier to debug
  - easier to maintain
  - So make one template each for network layer, database layer and application layer, cluster layer
  - Basic template is ready

```yaml
AWSTemplateFormatVersion: "2010-09-09"

Description: |
  Setup ECS Cluster
# Parameters:
# Mappings:
Resources:
  ECSCluster: #LogicalName
    Type: "AWS::ECS::Cluster"
# Outputs:
# Metadata:
```

# Deploy the template using a bin script

- Deploy script created with the full path to template.yaml and ran successfully

```sh
./deploy

Waiting for changeset to be created..
Changeset created successfully. Run the following command to review changes:
aws cloudformation describe-change-set --change-set-name arn:aws:cloudformation:ca-central-1:342196396576:changeSet/awscli-cloudformation-package-deploy-1687297072/97c07bc0-6796-4fc9-bc8e-40b0ecf58e5d
```

## Verified on AWS account - the template is in review mode as shown below

![Cloud Formation Tempalte - In Review](assets/week10/cfn_template_in_review.png)
