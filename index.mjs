// export const handler = async (event) => {
//   // TODO implement
//   const response = {
//     statusCode: 200,
//     body: JSON.stringify('Hello from Lambda!'),
//   };
//   return response;
// };
let instanceId = [];
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";
import { SSMClient, SendCommandCommand } from "@aws-sdk/client-ssm";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
const ec2 = new EC2Client({ region: "us-east-1" });
const ssm = new SSMClient({ region: "us-east-1" });

const handler = async (event) => {
  console.log(event);
  console.log(event.Records[0].dynamodb);
  const record = event.Records[0];
  try {
    if (record.eventName === "INSERT") {
      const file_id = record.dynamodb.NewImage.id.S;
      console.log("iddddd", file_id);
      const s3Bucket = "my-python-script";
      const pythonScriptKey = "index.py";

      const u = `#!/bin/bash
sudo apt-get update -y
sudo apt-get install awscli -y
sudo apt-get install python3-pip -y
cd /home/ubuntu
aws s3 cp s3://my-python-script/index.py /tmp/script.py
cd /tmp
pip3 install boto3
python3 /tmp/script.py ${file_id}`;

      // Launch a new EC2 instance
      const instanceResponse = await ec2.send(
        new RunInstancesCommand({
          ImageId: "ami-0cd59ecaf368e5ccf",
          InstanceType: "t2.micro",
          KeyName: "my-key-pair",
          MinCount: 1,
          MaxCount: 1,
          IamInstanceProfile: { Name: "ec2-arc" },
          SecurityGroupIds: ["sg-02f534d1669ca01fe"],
          UserData: Buffer.from(u).toString("base64"),
          TagSpecifications: [
            {
              ResourceType: "instance",
              Tags: [
                {
                  Key: "Name",
                  Value: "my-vm",
                },
              ],
            },
          ],
        })
      );

      instanceId = instanceResponse.Instances[0].InstanceId;
      console.log(instanceId);
      await waitForInstanceRunning(instanceId);
      // Construct command to download and execute the Python script on EC2
      const command = `aws s3 cp s3://${s3Bucket}/${pythonScriptKey} /tmp/script.py && python3 /tmp/script.py ${file_id}`;
      console.log(command);
      await sleep(10000);
      const fileNme = record.dynamodb.NewImage.input_file_path.S;
      const checkName = fileNme.split("/")[1];
      await waitForFileCreation("archit-fovus-out", `Out-${checkName}.txt`);
      await ec2.send(
        new TerminateInstancesCommand({
          InstanceIds: [instanceId],
        })
      );
      console.log(`EC2 instance ${instanceId} terminated.`);
    }
  } catch (error) {
    console.error("Error occurred:", error);
    if (instanceId) {
      await ec2.send(
        new TerminateInstancesCommand({
          InstanceIds: [instanceId],
        })
      );
      console.log(`EC2 instance ${instanceId} terminated.`);
    }
    throw error;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const s3 = new S3Client({ region: "us-east-1" });

async function waitForFileCreation(bucketName, objectKey) {
  while (true) {
    try {
      // Check if the object exists in S3
      await s3.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      );
      return true; // File exists, return true
    } catch (error) {
      if (error.name === "NotFound") {
        // File does not exist yet, wait for some time and retry
        await sleep(5000); // Wait for 5 seconds before checking again
      } else {
        throw error; // Throw if it's an unexpected error
      }
    }
  }
}

async function waitForInstanceRunning(instanceId) {
  while (true) {
    const describeResponse = await ec2.send(
      new DescribeInstancesCommand({
        InstanceIds: [instanceId],
      })
    );
    const state = describeResponse.Reservations[0].Instances[0].State.Name;
    if (state === "running") {
      break; // Exit the loop when instance is running
    }
    await sleep(5000); // Wait for 5 seconds before checking again
  }
}

export { handler };
