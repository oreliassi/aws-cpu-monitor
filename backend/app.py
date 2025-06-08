from flask import Flask, request, jsonify, send_from_directory
import boto3
from datetime import datetime
import ipaddress

app = Flask(__name__, static_folder='../frontend', static_url_path='')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/api/cpu', methods=['POST'])
def get_cpu_data():
    try:
        data = request.get_json()
        ip = data.get('ip')

        try:
            ipaddress.ip_address(ip)
        except ValueError:
            return jsonify({'error': 'Invalid IP address format'}), 400

        start_time = data.get('startTime')
        end_time = data.get('endTime')
        period = int(data.get('period'))

        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))

        session = boto3.Session(profile_name='default')

        ec2 = session.client('ec2')
        response = ec2.describe_instances(
            Filters=[{'Name': 'private-ip-address', 'Values': [ip]}]
        )

        reservations = response.get('Reservations', [])
        if not reservations or not reservations[0]['Instances']:
            return jsonify({'error': 'Instance with this IP not found'}), 404

        instance_id = reservations[0]['Instances'][0]['InstanceId']

        cloudwatch = session.client('cloudwatch')

        cw_response = cloudwatch.get_metric_statistics(
            Namespace='AWS/EC2',
            MetricName='CPUUtilization',
            Dimensions=[
                {'Name': 'InstanceId', 'Value': instance_id}
            ],
            StartTime=start,
            EndTime=end,
            Period=period,
            Statistics=['Average'],
            Unit='Percent'
        )

        datapoints = sorted(cw_response['Datapoints'], key=lambda x: x['Timestamp'])
        timestamps = [dp['Timestamp'].isoformat() for dp in datapoints]
        values = [round(dp['Average'], 2) for dp in datapoints]

        return jsonify({
            'timestamps': timestamps,
            'values': values
        })

    except Exception as e:
        print("Error in /api/cpu:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
