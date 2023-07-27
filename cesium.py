from flask import Flask, render_template

import os

cwd = os.path.dirname(os.path.realpath(__file__))
app = Flask(__name__, template_folder=cwd+'/static', static_folder=cwd+'/static')

@app.route('/')
def cesium():
    return render_template('/html/cesium.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
