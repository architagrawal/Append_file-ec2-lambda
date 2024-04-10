# Lambda Function - Process Files

This Lambda Function is responsible for initiating an new EC2 instance, loading the script from s3 to ec2, executing the script on ec2 and terminating the ec2 instance.

## Run Locally

1. Clone the project

```bash
  git clone https://github.com/architagrawal/fovus-ec2-lambda.git
```

2. ZIP the folder

3. Upload the ZIP file to Lambda Function

4. Configure Trigger, when a new item is entered in DynamoDB.
