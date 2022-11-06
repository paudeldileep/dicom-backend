#python script to convert dicom images to jpg/png 
#but there is problem with pydicom library

import pydicom
import os
import cv2

# make it True if you want in PNG format
PNG = False
# Specify the .dcm folder path
folder_path = "images"
# Specify the output jpg/png folder path
jpg_folder_path = "images_jpg"
images_path = os.listdir(folder_path)
for n, image in enumerate(images_path):
    ds = pydicom.dcmread(os.path.join(folder_path, image))
    pixel_array_numpy = ds.pixel_array
    if PNG == False:
        image = image.replace('.dcm', '.jpg')
    else:
        image = image.replace('.dcm', '.png')
    cv2.imwrite(os.path.join(jpg_folder_path, image), pixel_array_numpy)
    if n % 50 == 0:
        print('{} image converted'.format(n))
